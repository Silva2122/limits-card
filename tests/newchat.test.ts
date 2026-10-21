import { describe, expect, mock, test } from 'claude-code/testing'

import { linkOf, noteOf, stampOf } from '../hooks/newchat'

const T0 = Date.UTC(2026, 9, 16, 12, 0, 0)

describe('newchat helpers', () => {
  test('noteOf keeps the handoff and drops the trial-run lines above it', () => {
    expect(noteOf('Trial run done (no /clear), context 1\n\nHANDOFF: Делаем мод')).toBe('HANDOFF: Делаем мод')
    expect(noteOf('Trial run failed')).toBeUndefined()
    expect(noteOf(undefined)).toBeUndefined()
  })

  test('linkOf passes the folder of a real project and the note path', () => {
    const url = linkOf('/Users/m/.claude/handoffs/h.md', '/Users/m/Desktop/nerpa')
    expect(url.startsWith('claude://code/new?folder=%2FUsers%2Fm%2FDesktop%2Fnerpa&q=')).toBe(true)
    expect(decodeURIComponent(url.split('q=')[1])).toContain('/Users/m/.claude/handoffs/h.md')
    expect(url).not.toContain('+')
  })

  test('linkOf leaves out a folder the app made for the session', () => {
    expect(linkOf('/h.md', '/Users/m/Library/Application Support/Claude/scratch-workspaces/a/b')).not.toContain('folder=')
  })

  test('stampOf is sortable', () => {
    expect(stampOf(T0)).toMatch(/^2026-10-16-\d{6}$/)
  })
})

describe('newchat command', () => {
  test('/newchat writes the note and opens a new chat', async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const written: string[] = []
    const opened: string[][] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', ($, e) => ({ value: { command: e.name } }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.toast', () => ({ value: undefined }))
    on('env.get', () => ({ value: '/Users/m' }))
    on('session.cwd', () => ({ value: '/work' }))
    on('session.usage', () => ({ value: { startedAt: T0, context: { window: 1_000_000, tokens: 1000 }, rateLimits: [] } }))
    on('command.run', { command: 'handoff' }, () => ({ text: 'Trial run done\n\nHANDOFF: тест' }))
    on('fs.write', ($, e) => { written.push(`${e.path}|${e.text}`); return { value: undefined } })
    on('process.run', ($, e) => { opened.push([...e.argv]); return { value: { exitCode: 0, stdout: '', stderr: '' } } })
    await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
    const r = await $.command.run({ command: 'newchat', args: '' })
    expect(r.text).toContain('Готовлю записку')
    await clock.advance(0)
    expect(written.length).toBe(1)
    expect(written[0]).toContain('/Users/m/.claude/handoffs/handoff-')
    expect(written[0]).toContain('HANDOFF: тест')
    expect(opened[0][0]).toBe('open')
    expect(opened[0][1]).toContain('claude://code/new?folder=%2Fwork&q=')
  })
})
