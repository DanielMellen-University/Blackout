import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { operationPerformanceRecord, pathOutcomesDiffer } from '../src/systems/operation/measure'
import { OPERATION_STAGES } from '../src/systems/operation/identity'

const stored = JSON.parse(readFileSync(new URL('../docs/reviews/operation-11.038/performance.json', import.meta.url), 'utf8'))

describe('operation performance record', () => {
  it('records a positive harness time without treating it as frames per second', () => {
    expect(stored.note).toContain('not frames per second')
    expect(stored.wallMs).toBeGreaterThan(0)
    expect(stored.wallMs).toBeLessThan(10_000)
    expect(stored.node).toMatch(/^v22\./)
  })

  it('matches a fresh seed-42 flight of every decision path', () => {
    const { wallMs, node, ...record } = stored
    expect(wallMs).toBeGreaterThan(0)
    expect(node).toMatch(/^v/)
    expect(record).toEqual(operationPerformanceRecord(42))
    expect(pathOutcomesDiffer(record.paths)).toBe(true)
  })

  it('gives the four flown paths different scores and medals', () => {
    expect(stored.paths['valley-commit'].medal).toBe('gold')
    expect(stored.paths['valley-commit'].score).toBe(61472)
    expect(stored.paths['valley-conserve'].medal).toBe('silver')
    expect(stored.paths['ridge-commit'].medal).toBe('silver')
    expect(stored.paths['ridge-conserve'].medal).toBe('bronze')
    expect(stored.paths['ridge-conserve'].score).toBe(42947)
    expect(stored.paths['valley-commit'].peakSpeedMps).toBeGreaterThan(700)
    expect(stored.paths['valley-conserve'].minClearanceM).toBeLessThan(stored.paths['ridge-conserve'].minClearanceM)
  })

  it('does not report distinct outcomes when a canonical decision path is missing', () => {
    const incomplete = { ...stored.paths }
    delete incomplete['ridge-commit']
    incomplete.unexpected = { ...stored.paths['ridge-commit'], score: stored.paths['ridge-commit'].score + 1 }
    expect(pathOutcomesDiffer(incomplete)).toBe(false)
  })

  it('keeps three measured stages in order and accounts for every model step', () => {
    for (const path of Object.values(stored.paths)) {
      expect(path.stages.map((stage: { id: string }) => stage.id)).toEqual(OPERATION_STAGES)
      expect(path.steps).toBe(path.stages.reduce((steps: number, stage: { steps: number }) => steps + stage.steps, 0))
      expect(path.elapsedSec).toBeCloseTo(path.stages.reduce((seconds: number, stage: { elapsedSec: number }) => seconds + stage.elapsedSec, 0), 2)
      expect(path.stages.every((stage: { passed: boolean; steps: number }) => stage.passed && stage.steps > 0)).toBe(true)
    }
  })
})
