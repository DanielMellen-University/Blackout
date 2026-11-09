import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { operationPerformanceRecord, pathOutcomesDiffer } from '../src/systems/operation/measure'

const stored = JSON.parse(readFileSync(new URL('../docs/reviews/operation-11.037/performance.json', import.meta.url), 'utf8'))

describe('operation performance record', () => {
  it('records a positive harness time without treating it as frames per second', () => {
    expect(stored.note).toContain('not frames per second')
    expect(stored.wallMs).toBeGreaterThan(0)
    expect(stored.wallMs).toBeLessThan(10_000)
    expect(stored.node).toMatch(/^v22\./)
  })
})
