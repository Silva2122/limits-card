import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

const pane = (bodyColumns = 44) => ({
  component: 'Pane' as const,
  requestId: 'limits-card',
  props: { title: 'Лимиты', isFocused: false, bodyColumns, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 30 }, view: {} },
})
const START = { surface: 'desktop' as const, isInteractive: true, cwd: '/work' }
const T0 = Date.UTC(2026, 9, 16, 12, 0, 0)

function world(on: On, runs: string[]) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => ({
    value: {
      startedAt: T0,
      context: { window: 1_000_000, tokens: 62_400 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 12, resetsAt: new Date(T0 + 3_600_000).toISOString() }],
    },
  }))
  on('command.run', { command: 'handoff' }, ($, e) => {
    runs.push(`${e.command} ${e.args}`)
    return { text: 'ok' }
  })
}

describe('pane', () => {
  test('desktop card shows the context row, a /handoff now button and a new-chat button', async ($, on) => {
    mock.clock(on, { now: T0 })
    const runs: string[] = []
    world(on, runs)
    await $.session.start(START)
    const ui = await $.ui.mount({ plugin: 'limits-card', surface: 'desktop', ...pane() })
    const svg = await ui.find({ type: 'Svg' })
    expect(String(svg?.props.alt)).toContain('Контекст: 62k из 300k')
    await ui.press({ key: 'handoff-now' })
    expect(runs).toEqual(['handoff now'])
    await ui.press({ key: 'new-chat' })
    expect(runs).toEqual(['handoff now', 'handoff dry'])
    await ui.unmount()
  })

  test('terminal falls back to text lines', async ($, on) => {
    mock.clock(on, { now: T0 })
    world(on, [])
    await $.session.start({ ...START, surface: 'terminal' })
    const ui = await $.ui.mount({ plugin: 'limits-card', surface: 'terminal', ...pane() })
    expect(await ui.find({ type: 'Text', text: /Контекст 62k/ })).toBeDefined()
    await ui.unmount()
  })
})
