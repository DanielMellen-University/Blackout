import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('removed aircraft overlays', () => {
  it('does not allocate or update cone, streak, or shockwave effects in the runtime', () => {
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
    for (const name of ['MachConeFx', 'SpeedStreakFx', 'SonicBoomFx']) {
      expect(main).not.toContain(name)
      expect(existsSync(new URL(`../src/systems/${name}.ts`, import.meta.url))).toBe(false)
    }
    expect(main).toContain("audio.playCue('sonic-boom')")
    expect(main).toContain('supersonic.update(')
    expect(main).toContain('waterWakeFx.update(')
    expect(main).toContain('groundWakeFx.update(')
  })

  it('does not rebuild the lamp or vapor geometry, or keep their update loops', () => {
    const model = readFileSync(new URL('../src/aircraft/createF35Model.ts', import.meta.url), 'utf8')
    const aircraft = readFileSync(new URL('../src/aircraft/Aircraft.ts', import.meta.url), 'utf8')
    for (const source of [model, aircraft]) {
      expect(source).not.toMatch(/landingLight|vaporTrail|vaporNodes|wingtipVapor/)
    }
    expect(model).toContain('root.add(buildAfterburner())')
    expect(model).toContain('buildGear(root, metal, rubber, skin)')
  })
})
