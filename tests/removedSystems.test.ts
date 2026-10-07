import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('removed vision and natural-prop systems', () => {
  it('removes the flight-warning category, evaluation, audio, and styling', () => {
    expect(existsSync(new URL('../src/systems/FlightWarnings.ts', import.meta.url))).toBe(false)
    for (const path of ['src/main.ts', 'src/audio/FlightAudio.ts', 'src/ui/HUD.ts', 'src/style.css', 'index.html']) {
      expect(read(path), path).not.toMatch(/lowAltitudeWarning|terrainClosureWarning|terrainLookaheadWarning|warning-low-alt|'pull-up'|'low-alt'|clearance-warning|clearance-caution/)
      expect(read(path), path).not.toMatch(/FlightWarningTracker|evaluateWarnings|warningObstacleSampler|hud-warn|warningCueForState|warningCueClass|\.warn\b|'stall'|'go-around'|'flare'|'gear-warning'/)
    }
    expect(read('src/main.ts')).toContain('collision.check(aircraft)')
    expect(read('src/main.ts')).toContain('hudFrame.y =')
    expect(read('src/aircraft/FlightModel.ts')).toContain('C.minSpeed')
  })

  it('removes vision effects, banners, and audio triggers, but keeps load telemetry', () => {
    expect(existsSync(new URL('../src/systems/GLoadFeedback.ts', import.meta.url))).toBe(false)
    const main = read('src/main.ts'), hud = read('src/ui/HUD.ts')
    for (const source of [main, hud, read('src/audio/FlightAudio.ts'), read('index.html'), read('src/style.css')]) {
      expect(source).not.toMatch(/GLoadFeedback|gLoadVision|gLoadCueBand|g-load-veil|blackoutVignette|redoutWash|g-high|g-negative/)
    }
    expect(main).toContain('hudFrame.gForce = aircraft.loadFactor')
    expect(hud).toContain('this.gText = formatGForce(shown)')
  })

  it('removes the factory, streaming hooks, and quality knobs instead of a hidden flag', () => {
    expect(existsSync(new URL('../src/world/vegetation.ts', import.meta.url))).toBe(false)
    for (const path of ['src/world/TerrainSystem.ts', 'src/world/World.ts', 'src/world/TerrainWorkerPool.ts', 'src/core/RenderQuality.ts']) {
      expect(read(path), path).not.toMatch(/vegetation|vegFactory|buildProps|withProps|hasProps|propMeshes|fadeProps/i)
    }
    expect(read('AGENTS.md')).toContain('Vegetation development is paused')
    expect(read('docs/ROADMAP.md')).toContain('Do not resume')
  })

  it('cleans feature claims and future recommendations from documentation', () => {
    for (const path of ['docs/PROJECT_OVERVIEW.md', 'docs/AUDIT-2026-09-04.md', 'docs/terrain-streaming-performance.md']) {
      expect(read(path), path).not.toMatch(/vegetation|foliage|blackout\/redout|G-load\/blackout/i)
    }
    // The release note records the removal; it must not coexist with older
    // instructions or shipped claims that encourage restoring these systems.
    expect(read('CHANGELOG.md').match(/vegetation|foliage|blackout\/redout|high-G vision/gi)).toHaveLength(2)
  })
})
