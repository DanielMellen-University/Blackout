import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('CI workflow', () => {
  const workflow = read('.github/workflows/ci.yml')
  const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>

  it('offers the same TypeScript check CI runs as an npm script', () => {
    expect(workflow).toContain('run: npx tsc --noEmit')
    expect(scripts.typecheck).toBe('tsc --noEmit')
  })

  it('only calls npm scripts that exist', () => {
    const called = [...workflow.matchAll(/run: npm run ([\w:-]+)/g)].map(match => match[1]!)
    expect(called.length).toBeGreaterThan(0)
    expect(called.filter(name => !(name in scripts))).toEqual([])
  })
})
