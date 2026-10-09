import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const html = read('index.html')
const controls = html.split('id="menu-controls"')[1]!.split('id="menu-info"')[0]!
const manual = html.split('id="menu-info"')[1]!.split('id="overlay"')[0]!

describe('pilot reference pages', () => {
  it('shares the oblique fighter and the same illustration styling across all four aircraft', () => {
    expect(html.match(/id="fighter-top"/g)).toHaveLength(1)
    expect(html.match(/href="#fighter-top"/g)).toHaveLength(2)
    expect(controls).toContain('data-plane-view="top"')
    for (const detail of ['fighter-canopy', 'fighter-detail', 'fighter-nozzle']) expect(html).toContain(`class="${detail}"`)
    expect(html).not.toContain('class="blueprint-aircraft"')
    expect(html).toContain('id="fighter-top" viewBox="0 0 240 80"')
    expect(controls).toContain('<use href="#fighter-top" width="240" height="80" />')
    const css = read('src/style.css')
    expect(css).toContain('.axis-aircraft, .fighter-top-view { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.5;')
    expect(css).not.toContain('vector-effect: non-scaling-stroke')
    const arrows = [...controls.matchAll(/class="axis-arrow" d="([^"]+)"/g)]
    expect(arrows).toHaveLength(3)
    for (const [, path] of arrows) expect(path).toMatch(/^M[\d ]+ Q[\d ]+ M[\d ]+ L[\d ]+ L[\d ]+$/)
    expect(read('src/ui/pilotGuide.css')).toContain('stroke-linecap: round; stroke-linejoin: round;')
  })
  it('uses distinct fighter views for pitch and roll and the requested launch label', () => {
    expect(html).toContain('<p class="title-kicker">Flight Simulator</p>')
    expect(html).not.toContain('Independent flight / F-35')
    for (const view of ['side', 'front']) {
      expect(controls.split(`data-plane-view="${view}"`)).toHaveLength(2)
    }
    expect(controls.match(/viewBox="0 0 240 80"/g)).toHaveLength(3)
    expect(controls.match(/class="axis-canopy"/g)).toHaveLength(2)
    expect(read('src/ui/pilotGuide.css')).toContain('height: 86px')
  })
  it('preserves unique live binding labels and groups the controls', () => {
    const main = read('src/main.ts')
    for (const id of ['controls-pitch-label', 'controls-yaw-keys', 'controls-yaw-keys-secondary',
      'controls-roll-keys', 'controls-roll-keys-secondary', 'controls-yaw-label', 'controls-roll-label',
      'controls-boost-label', 'controls-airbrake-label', 'controls-gear-label']) {
      expect(html.split(`id="${id}"`), id).toHaveLength(2)
      expect(controls, id).toContain(`id="${id}"`)
      expect(main, id).toContain(`getElementById('${id}')`)
    }
    for (const group of ['Power &amp; airframe', 'View &amp; navigation', 'Mission &amp; session', 'Controller reference']) {
      expect(controls).toContain(group)
    }
    expect(controls).toContain('D-pad ↑ · ↓</dt><dd>Weather · new world')
    expect(controls).toContain('D-pad ← · →</dt><dd>Ghost · radar target')
    expect(controls).toContain('From results or the crash cinematic')
    expect(controls).toContain('data-guide-view="info"')
    expect(manual).toContain('data-guide-view="controls"')
  })

  it('gives every chapter link a unique keyboard-focusable destination', () => {
    const links = [...manual.matchAll(/href="#(manual-[^"]+)"/g)]
    expect(links).toHaveLength(6)
    for (const [, id] of links) {
      expect(manual.split(`id="${id}"`)).toHaveLength(2)
      expect(manual).toContain(`id="${id}" class="manual-chapter" tabindex="-1"`)
    }
    expect(manual).toContain('aria-label="Flight manual chapters"')
    expect(manual).toContain('two white / two red')
    expect(manual).toContain('Water contact is a crash, not a landing')
    expect(manual).toContain('no cockpit frame or instruments')
    expect(manual).not.toMatch(/blackout\/redout|blackout veil|redout|vegetation|stall warning|go-around warning/i)
  })

  it('keeps desktop actions fixed and long content independently scrollable without animation', () => {
    const css = read('src/ui/pilotGuide.css')
    expect(html).toContain('href="/src/ui/pilotGuide.css"')
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) auto')
    expect(css).toContain('overflow-y: auto')
    expect(css).toContain('@media (max-height: 650px)')
    expect(css).not.toMatch(/@keyframes|url\(|#[0-9a-f]{3,8}\b/i)
  })
})
