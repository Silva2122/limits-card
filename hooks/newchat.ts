import type { EngineInterface } from 'claude-code'

let busy = false

/** the handoff itself, without the "trial run done" lines /handoff dry puts above it */
export function noteOf(text: string | undefined): string | undefined {
  if (!text) return undefined
  const at = text.indexOf('HANDOFF')
  return at < 0 ? undefined : text.slice(at).trim()
}

/** 2026-10-16-1430 in local time */
export function stampOf(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** a folder the app made for a session is gone with it, so the new chat gets none */
export function linkOf(file: string, cwd: string): string {
  const q = `Прочитай записку о передаче дел: ${file}\nКоротко расскажи текущее состояние и следующий шаг, затем жди указаний.`
  const params = new URLSearchParams()
  if (!cwd.includes('/scratch-workspaces/')) params.set('folder', cwd)
  params.set('q', q)
  return `claude://code/new?${params.toString().replace(/\+/g, '%20')}`
}

export async function newChat($: EngineInterface): Promise<string> {
  if (busy) return 'Записка уже готовится.'
  busy = true
  try {
    $.ui.toast('Готовлю записку для нового диалога…')
    const r = await $.command.run({ command: 'handoff', args: 'dry' })
    const note = noteOf(r.text)
    if (!note) {
      $.ui.toast('Не удалось подготовить записку')
      return 'Не удалось подготовить записку: ctx-handoff не вернул текст.'
    }
    const home = (await $.env.get('HOME')) ?? '~'
    const file = `${home}/.claude/handoffs/handoff-${stampOf(await $.clock.now())}.md`
    await $.fs.write(file, `${note}\n`)
    const run = await $.process.run(['open', linkOf(file, await $.session.cwd())])
    if (run.exitCode !== 0) {
      $.ui.toast('Не удалось открыть новый диалог')
      return `Записка сохранена в ${file}, но новый диалог не открылся.`
    }
    $.ui.toast('Новый диалог открыт: нажмите Enter')
    return `Записка: ${file}. Новый диалог открыт, нажмите в нём Enter.`
  } finally {
    busy = false
  }
}
