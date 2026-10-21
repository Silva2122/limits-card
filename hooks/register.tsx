import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { CtxRow, LimitRow, LimitsSnap } from '../types'
import { cardSvg, fmtK, fmtLeft, fmtPct, labelOf } from './card'
import { newChat } from './newchat'

const PANE = 'limits-card'
const TITLE = 'Лимиты'
const snap = atom({ plugin: 'limits-card', key: 'snap' } as const, null)
const ORDER = ['five_hour', 'seven_day', 'spend_limit']

let limits: SessionRateLimit[] = []
let ctx: CtxRow | undefined
let handoffAt = 300_000
let lastKey = ''

export function rowsOf(list: SessionRateLimit[]): LimitRow[] {
  return list
    .map(l => {
      const t = l.resetsAt ? Date.parse(l.resetsAt) : NaN
      return { kind: l.kind, pct: l.percentUsed, ...(Number.isFinite(t) ? { resetsAt: t } : {}) }
    })
    .sort((a, b) => ((ORDER.indexOf(a.kind) + 9) % 9) - ((ORDER.indexOf(b.kind) + 9) % 9))
}

/** ctx-handoff hands off at its threshold, or at 80% of a smaller window */
export function ctxOf(tokens: number | undefined, window: number, at: number): CtxRow | undefined {
  if (tokens === undefined) return undefined
  return { tokens, at: Math.min(at, Math.round(window * 0.8)) }
}

async function publish($: EngineInterface): Promise<void> {
  const minute = Math.floor((await $.clock.now()) / 60_000)
  const next: LimitsSnap = { minute, rows: rowsOf(limits), ...(ctx ? { ctx } : {}) }
  const key = JSON.stringify(next)
  if (key === lastKey) return
  await update($, snap, () => next)
  lastKey = key
}

async function sample($: EngineInterface): Promise<void> {
  try {
    const u = await $.session.usage()
    limits = u.rateLimits
    ctx = ctxOf(u.context.tokens, u.context.window, handoffAt)
  } catch {
    // keep the last readings
  }
  await publish($)
}

export const register: Register = (on, options) => {
  if (typeof options.handoffAt === 'number' && options.handoffAt > 0) handoffAt = options.handoffAt
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    limits = []
    lastKey = ''
    await $.command.register({ name: 'limits', description: 'Открыть или закрыть карточку лимитов', immediate: true })
    await $.command.register({ name: 'newchat', description: 'Записка о передаче дел и новый диалог с ней', immediate: true })
    await sample($).catch(() => undefined)
    $.clock.every(30_000, () => void sample($).catch(() => undefined))
    void $.ui.open({ id: PANE, title: TITLE })
    return started
  })

  on('command.run', { command: 'limits' }, async $ => {
    if ((await $.ui.panes()).some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: 'Карточка лимитов закрыта.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    await sample($).catch(() => undefined)
    return { text: 'Карточка лимитов открыта.' }
  })

  // a command.run hook cannot run /handoff dry itself: it would wait on its own turn
  on('command.run', { command: 'newchat' }, async $ => {
    $.clock.after(0, () => void newChat($).catch(() => $.ui.toast('Не удалось открыть новый диалог')))
    return { text: 'Готовлю записку и новый диалог…' }
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      limits = e.rateLimits
      await publish($).catch(() => undefined)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) void sample($).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = await read($, snap)
    const rows = s?.rows ?? []
    const now = await $.clock.now()

    if (e.surface === 'terminal' || e.surface === 'mobile') {
      const { Box, Text } = $.ui.resolve(e)
      if (!rows.length) return <Text dimColor>Лимиты появятся после первого ответа.</Text>
      const c = s?.ctx
      return (
        <Box flexDirection="column">
          {c && <Text key="ctx">Контекст {fmtK(c.tokens)} <Text dimColor>→ {fmtK(c.at)}</Text></Text>}
          {rows.map(r => (
            <Text key={r.kind}>
              {labelOf(r.kind)} {fmtPct(r.pct)}
              <Text dimColor>{r.resetsAt !== undefined ? `  ↻ ${fmtLeft(r.resetsAt - now)}` : ''}</Text>
            </Text>
          ))}
        </Box>
      )
    }

    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    const W = Math.max(220, Math.min(560, (e.props.bodyColumns || 40) * 8 - 8))
    const c = cardSvg(rows, now, W, s?.ctx)
    const handoff = () => void $.command.run({ command: 'handoff', args: 'now' }).catch(() => undefined)
    const fresh = () => void newChat($).catch(() => $.ui.toast('Не удалось открыть новый диалог'))
    return (
      <Box flexDirection="column" gap="xs">
        <Svg source={c.source} alt={c.alt} width={W} height={c.height} />
        {s?.ctx && (
          // a row of its own under the card, sized and lettered like the card's rows
          <Box key="handoff" width="100%" borderStyle="round" borderDimColor paddingX="md" paddingY="md" flexDirection="row" alignItems="center">
            <Button key="handoff-now" plain label="Очистить контекст" onPress={handoff} hover={{ color: 'suggestion' }}>
              <Text size="body">Очистить контекст</Text>
            </Button>
          </Box>
        )}
        {s?.ctx && (
          <Box key="newchat" width="100%" borderStyle="round" borderDimColor paddingX="md" paddingY="md" flexDirection="row" alignItems="center">
            <Button key="new-chat" plain label="Новый диалог" onPress={fresh} hover={{ color: 'suggestion' }}>
              <Text size="body">Новый диалог</Text>
            </Button>
          </Box>
        )}
      </Box>
    )
  })
}
