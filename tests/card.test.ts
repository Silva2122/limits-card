import { describe, expect, test } from 'claude-code/testing'

import { cardSvg, fmtK, fmtLeft, fmtPct } from '../hooks/card'
import { ctxOf, rowsOf } from '../hooks/register'

describe('limits-card', () => {
  test('formats time left in Russian', () => {
    expect(fmtLeft(41 * 60_000)).toBe('41м')
    expect(fmtLeft((4 * 60 + 41) * 60_000)).toBe('4ч 41м')
    expect(fmtLeft((29 * 60 + 11) * 60_000)).toBe('1д 5ч')
  })

  test('formats percent', () => {
    expect(fmtPct(1)).toBe('1%')
    expect(fmtPct(19.4)).toBe('19%')
    expect(fmtPct(2.5)).toBe('2.5%')
  })

  test('orders five-hour before weekly and parses reset time', () => {
    const rows = rowsOf([
      { kind: 'seven_day', percentUsed: 19, resetsAt: '2026-10-16T20:00:00Z' },
      { kind: 'five_hour', percentUsed: 1 },
    ])
    expect(rows.map(r => r.kind)).toEqual(['five_hour', 'seven_day'])
    expect(rows[1]!.resetsAt).toBe(Date.parse('2026-10-16T20:00:00Z'))
  })

  test('draws one thin row per window', () => {
    const now = Date.parse('2026-10-15T12:00:00Z')
    const c = cardSvg([
      { kind: 'five_hour', pct: 1, resetsAt: now + 4 * 3_600_000 },
      { kind: 'seven_day', pct: 19, resetsAt: now + 29 * 3_600_000 },
    ], now, 300)
    expect(c.height).toBe(94)
    expect(c.alt).toContain('5 часов: 1%, сброс через 4ч 0м')
    expect(c.source).toContain('Неделя')
  })

  test('context row counts towards the handoff point', () => {
    expect(fmtK(62_400)).toBe('62k')
    expect(fmtK(1_000_000)).toBe('1M')
    expect(ctxOf(62_400, 1_000_000, 300_000)).toEqual({ tokens: 62_400, at: 300_000 })
    expect(ctxOf(100_000, 200_000, 300_000)).toEqual({ tokens: 100_000, at: 160_000 })
    expect(ctxOf(undefined, 200_000, 300_000)).toBeUndefined()
    const c = cardSvg([{ kind: 'five_hour', pct: 1 }], 0, 300, { tokens: 62_400, at: 300_000 })
    expect(c.height).toBe(94)
    expect(c.alt).toContain('Контекст: 62k из 300k')
  })
})
