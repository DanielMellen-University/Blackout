/** Instruments that stay on the live picture. */
export const LIVE_HUD_IDS = [
  'hud-spd',
  'hud-pos',
  'heading-tape',
  'attitude',
  'hud-thr',
  'hud-ab-state',
  'nav-cue',
  'nav-arrow',
  'nav-range',
  'hud-warn',
  'hud-warn-text',
  'hud-fuel',
  'hud-fuel-fill',
] as const

/**
 * Ledger readouts. Each id must sit on an element with `hud-ledger`,
 * or on a descendant of one, so the flight picture cannot show it.
 */
export const LEDGER_HUD_IDS = [
  'hud-mach',
  'hud-state',
  'hud-cam',
  'hud-hdg',
  'hud-audio',
  'hud-weather',
  'hud-wind',
  'hud-phase',
  'hud-pace',
  'hud-ghost-pace',
  'hud-route-risk',
  'hud-contract-streak',
  'hud-live-score',
  'hud-precision',
  'hud-climb',
  'hud-biome',
  'hud-combo',
  'hud-fuel-endurance',
  'hud-engine-heat',
  'hud-refuel',
  'hud-contract-detail',
  'nav-approach',
  'nav-line',
  'nav-speed',
  'nav-glide',
  'nav-trend',
  'nav-eta',
  'nav-alt',
] as const

const TAG_RE = /<\/?([a-zA-Z0-9-]+)([^<>]*)>/g
const VOID_TAG = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i

/** True when `hud-ledger` hides this id in the shipped markup. */
export function hudIdIsLedger(html: string, id: string): boolean {
  const at = html.indexOf(`id="${id}"`)
  if (at < 0) return false
  const tags = [...html.matchAll(TAG_RE)]
  const stack: number[] = []
  for (let i = 0; i < tags.length; i += 1) {
    const full = tags[i]?.[0] ?? ''
    const name = tags[i]?.[1] ?? ''
    const start = tags[i]?.index ?? -1
    if (full.startsWith('</')) {
      for (let s = stack.length - 1; s >= 0; s -= 1) {
        const openName = tags[stack[s] ?? 0]?.[1]
        stack.pop()
        if (openName === name) break
      }
      continue
    }
    const ownsId = start < at && start + full.length > at
    if (ownsId) {
      if (/\bhud-ledger\b/.test(full)) return true
      return stack.some((index) => /\bhud-ledger\b/.test(tags[index]?.[0] ?? ''))
    }
    if (full.endsWith('/>') || VOID_TAG.test(name)) continue
    stack.push(i)
  }
  return false
}

/** Empty when the live picture matches the flight-instrument budget. */
export function liveHudViolations(html: string, css: string): string[] {
  const violations: string[] = []
  if (!/\.hud-ledger\b[^{]*\{[^}]*display:\s*none\s*!important/.test(css)) {
    violations.push('css does not hide .hud-ledger')
  }
  if (!/\.result-ledger\b[^{]*\{[^}]*display:\s*none\s*!important/.test(css)) {
    violations.push('css does not hide .result-ledger')
  }
  for (const id of LIVE_HUD_IDS) {
    if (!html.includes(`id="${id}"`)) violations.push(`missing live instrument ${id}`)
    else if (hudIdIsLedger(html, id)) violations.push(`live instrument ${id} is in the ledger`)
  }
  for (const id of LEDGER_HUD_IDS) {
    if (!html.includes(`id="${id}"`)) violations.push(`missing ledger node ${id}`)
    else if (!hudIdIsLedger(html, id)) violations.push(`ledger node ${id} is visible`)
  }
  return violations
}
