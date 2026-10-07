import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROADMAP_CHUNK } from '../src/core/Version'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

describe('README pitch', () => {
  it('says what the game is, how to run it, how to fly, and how a sortie ends', () => {
    expect(readme).toContain('Current release: **v0.12.0** (`Systems expansion`)')
    expect(readme).toContain(`Roadmap chunk: **${ROADMAP_CHUNK}**`)
    expect(readme).toContain('npm run dev')
    expect(readme).toContain('W / S pitch')
    expect(readme).toContain('land or crash')
    expect(readme).toMatch(/retry the same course/i)
    expect(readme.split('\n').length).toBeLessThan(80)
    expect(readme).not.toContain('Seeded sorties')
    expect(readme).not.toContain('THERMAL SURF')
    expect(readme).not.toContain('commendation')
  })
})

describe('game info', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const info = html.slice(html.indexOf('id="menu-info"'), html.indexOf('id="overlay"'))

  it('describes thrust and the short task list, not the old speed target or timer tasks', () => {
    expect(info).toContain('Throttle controls thrust')
    expect(info).toContain('Fly gates in order')
    expect(info).toContain('return and land')
    expect(info).toContain('Crashes also show your score')
    expect(info).not.toContain('1500 kts')
    expect(info).not.toContain('speed target')
    expect(info).not.toContain('CROSSWIND')
    expect(info).not.toContain('ENERGY BAND')
    expect(info).not.toContain('GUST RIDER')
    expect(info).not.toContain('MACH RUN')
    expect(info).not.toContain('PRECISION CHAIN')
  })
})
