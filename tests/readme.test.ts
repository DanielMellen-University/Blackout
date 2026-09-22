import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

describe('README pitch', () => {
  it('says what the game is, how to run it, how to fly, and how a sortie ends', () => {
    expect(readme).toContain('Current release: **v0.11.0** (`Systems expansion`)')
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
