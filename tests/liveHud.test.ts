import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEDGER_HUD_IDS, LIVE_HUD_IDS, liveHudViolations } from '../src/ui/liveHudBudget'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

describe('live HUD budget', () => {
  it('keeps instruments and the objective without a flight-warning strip', () => {
    expect(liveHudViolations(html, css)).toEqual([])
    for (const id of LIVE_HUD_IDS) expect(html).toContain(`id="${id}"`)
    for (const id of LEDGER_HUD_IDS) expect(html).toContain(`id="${id}"`)
  })

  it('does not let the flight loop unhide a ledger row by deleting the class', () => {
    const source = readFileSync(new URL('../src/ui/HUD.ts', import.meta.url), 'utf8')
    expect(source.includes("classList.remove('hud-ledger')")).toBe(false)
    expect(source.includes('classList.remove("hud-ledger")')).toBe(false)
  })

  it('keeps navigation compact rather than stretching across the viewport', () => {
    const layout = css.slice(css.indexOf('/* One flight-deck layout'))
    expect(layout).toContain('#nav-cue { grid-area: navigation; width: fit-content;')
    expect(layout).toContain('max-width: min(380px, 100%)')
    const primary = html.match(/<div class="nav-primary">([\s\S]*?)<\/div>\s*<div id="nav-meta">/)?.[1] ?? ''
    for (const id of ['nav-target', 'nav-arrow', 'nav-turn', 'nav-range']) expect(primary).toContain(`id="${id}"`)
  })

  it('gives the compass and navigation independent grid ownership on short screens', () => {
    const layout = css.slice(css.indexOf('/* One flight-deck layout'))
    expect(layout).toContain('#heading-tape { grid-area: compass;')
    expect(layout).toContain('#nav-cue { grid-area: navigation;')
    expect(layout).toContain('"brand compass readouts"')
    expect(layout).toContain('"gauges navigation readouts"')
    expect(layout).toContain('inset: auto;')
    expect(layout).toContain('transform: none;')
  })

  it('rejects hiding essential landing guidance or expanded debrief records', () => {
    const hiddenGlide = html.replace('id="nav-glide"', 'class="hud-ledger" id="nav-glide"')
    expect(liveHudViolations(hiddenGlide, css)).toContain('live instrument nav-glide is in the ledger')
    expect(liveHudViolations(html, `${css}\n.result-ledger { display: none !important; }`))
      .toContain('debrief records must remain accessible when expanded')
  })

  it('removes the whole flight-warning strip and its styling', () => {
    expect(css).not.toContain('warning-low-alt')
    expect(css).not.toContain('clearance-warning')
    expect(css).not.toMatch(/\.warn\b|warning-flare|warning-go-around|warn-pulse/)
    expect(css).not.toContain('#hud-vs.flare')
    expect(html).not.toContain('hud-warn')
    expect(html).toContain('id="nav-glide"')
  })

  it('keeps debrief coaching visible and results scrollable on short screens', () => {
    const panel = css.match(/\.run-results-panel\s*\{[^}]*max-height:[^}]*\}/)?.[0] ?? ''
    expect(panel).toContain('max-height: calc(100dvh - 48px)')
    expect(panel).toContain('grid-template-rows: minmax(0, 1fr) auto')
    expect(panel).toContain('overflow: hidden')
    const content = css.match(/\.report-content\s*\{[^}]*\}/)?.[0] ?? ''
    expect(content).toContain('overflow-y: auto')
    expect(html).toMatch(/class="report-share"[\s\S]*?<\/details>\s*<\/div>\s*<footer class="report-actions">/)
    expect(html).toMatch(/<footer class="report-actions">\s*<button[^>]*id="btn-retry"[^>]*>[\s\S]*?id="btn-new-world"[\s\S]*?<\/footer>/)
    expect(css).toContain('.report-mission { display: grid; gap: 6px; margin-bottom: 20px; }')
    expect(css).toContain('.report-mission > p { margin: 0; line-height: 1.5; }')
    for (const id of ['result-coaching', 'result-touchdown']) {
      const element = html.match(new RegExp(`<p[^>]*id="${id}"[^>]*>`))?.[0] ?? ''
      expect(element).not.toBe('')
      expect(element).not.toContain('result-ledger')
    }
  })
})
