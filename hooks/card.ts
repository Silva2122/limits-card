import type { CtxRow, LimitRow } from '../types'

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

// Colors follow the desktop app's own cards: light by default, dark under prefers-color-scheme.
const CSS = `
.card{fill:none;stroke:#e2e2de}.sep{stroke:#ececea}
.lbl{fill:#1f1f1f}.val{fill:#6b6b68}.dim{fill:#9a9a96}.trk{fill:#e8e8e4}
@media (prefers-color-scheme: dark){.card{stroke:#3a3a38}.sep{stroke:#2e2e2c}.lbl{fill:#ececec}.val{fill:#9d9d99}.dim{fill:#6f6f6b}.trk{fill:#2f2f2d}}
`

const ROW_H = 46
const PAD = 18

export function labelOf(kind: string): string {
  if (kind === 'five_hour') return '5 часов'
  if (kind === 'seven_day') return 'Неделя'
  if (kind === 'spend_limit') return 'Бюджет'
  return kind.replace(/_/g, ' ')
}

export function fmtLeft(ms: number): string {
  if (ms <= 0) return 'сейчас'
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m}м`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}ч ${m % 60}м`
  const d = Math.floor(h / 24)
  return `${d}д ${h % 24}ч`
}

export function fmtPct(p: number): string {
  return `${p < 10 && p % 1 ? p.toFixed(1) : Math.round(p)}%`
}

export function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}

export function barColor(p: number): string {
  return p >= 95 ? '#e5534b' : p >= 80 ? '#e0a030' : '#3b82f6'
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function text(x: number, y: number, s: string, cls: string, anchor: 'start' | 'end' = 'start', size = 14): string {
  return `<text class="${cls}" x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" text-anchor="${anchor}" font-variant-numeric="tabular-nums">${esc(s)}</text>`
}

function pill(p: string[], bx: number, cy: number, pct: number): void {
  const bw = 44
  const bh = 18
  const fill = Math.max(bh, (bw * Math.min(100, pct)) / 100)
  p.push(`<rect class="trk" x="${bx}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="${bh / 2}"/>`)
  p.push(`<rect x="${bx}" y="${cy - bh / 2}" width="${fill.toFixed(1)}" height="${bh}" rx="${bh / 2}" fill="${barColor(pct)}"/>`)
}

export function cardSvg(rows: LimitRow[], now: number, W: number, ctx?: CtxRow): { source: string; height: number; alt: string } {
  const list = rows.length ? rows : []
  const H = (Math.max(1, list.length) + (ctx ? 1 : 0)) * ROW_H + 2
  const p: string[] = [`<rect class="card" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14"/>`]
  const alt: string[] = []
  if (!list.length) {
    p.push(text(PAD, ROW_H / 2 + 6, 'Лимиты', 'lbl'))
    p.push(text(W - PAD, ROW_H / 2 + 6, 'после первого ответа', 'dim', 'end', 13))
    alt.push('Лимиты появятся после первого ответа')
  }
  list.forEach((r, i) => {
    const y0 = 1 + i * ROW_H
    const cy = y0 + ROW_H / 2
    if (i > 0) p.push(`<line class="sep" x1="${PAD}" x2="${W - PAD}" y1="${y0}" y2="${y0}"/>`)
    const left = r.resetsAt !== undefined ? fmtLeft(r.resetsAt - now) : ''
    const name = labelOf(r.kind)
    p.push(text(PAD, cy + 5, name, 'lbl'))
    // bar: 44×18 pill, like the Context card's
    const bx = W - PAD - 44
    pill(p, bx, cy, r.pct)
    p.push(text(bx - 10, cy + 5, fmtPct(r.pct), 'val', 'end'))
    // reset countdown right after the label, dim, as the app's own secondary text
    if (left) p.push(text(PAD + name.length * 7.6 + 10, cy + 5, `↻ ${left}`, 'dim', 'start', 12))
    alt.push(`${name}: ${fmtPct(r.pct)}${left ? `, сброс через ${left}` : ''}`)
  })
  if (ctx) {
    // context row: how far the session is towards ctx-handoff's threshold
    const y0 = 1 + Math.max(1, list.length) * ROW_H
    const cy = y0 + ROW_H / 2
    const pct = ctx.at > 0 ? (ctx.tokens / ctx.at) * 100 : 0
    const bx = W - PAD - 44
    p.push(`<line class="sep" x1="${PAD}" x2="${W - PAD}" y1="${y0}" y2="${y0}"/>`)
    p.push(text(PAD, cy + 5, 'Контекст', 'lbl'))
    p.push(text(PAD + 8 * 7.6 + 10, cy + 5, `→ ${fmtK(ctx.at)}`, 'dim', 'start', 12))
    pill(p, bx, cy, pct)
    p.push(text(bx - 10, cy + 5, fmtK(ctx.tokens), 'val', 'end'))
    alt.push(`Контекст: ${fmtK(ctx.tokens)} из ${fmtK(ctx.at)} до передачи дел`)
  }
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${CSS}</style>${p.join('')}</svg>`
  return { source, height: H, alt: alt.join('; ') }
}
