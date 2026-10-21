export type LimitRow = {
  kind: string
  /** 0..100 */
  pct: number
  /** ms since epoch, when the window resets */
  resetsAt?: number
}

export type CtxRow = {
  /** context tokens in use now */
  tokens: number
  /** tokens at which ctx-handoff hands the session off */
  at: number
}

export type LimitsSnap = {
  /** minute stamp, so the countdown redraws once a minute */
  minute: number
  rows: LimitRow[]
  ctx?: CtxRow
}

declare module 'claude-code' {
  interface PluginState {
    'limits-card': { snap: LimitsSnap | null }
  }
}
