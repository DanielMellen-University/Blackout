import { describe, expect, it, vi } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import type { Aircraft } from '../src/aircraft/Aircraft'
import { createDefaultControls } from '../src/core/types'
import { FlightReview, ReviewFrames } from '../src/debug/FlightReview'
import * as terrain from '../src/world/terrainSample'

describe('fixed-route frame measurement', () => {
  it('reports real frame intervals including hitches', () => {
    const frames = new ReviewFrames()
    for (const now of [100, 116, 132, 148, 164, 1164]) frames.record(now, true)
    expect(frames.summary()).toEqual({ samples: 5, median: 16, p95: 1000, p99: 1000, max: 1000, over50: 1, over100: 1 })
  })
  it('excludes explicit hidden and paused gaps, not slow visible frames', () => {
    const frames = new ReviewFrames()
    frames.record(100, true); frames.record(120, true); frames.record(1000, false)
    frames.record(20000, true); frames.record(20040, true)
    expect(frames.summary()).toEqual({ samples: 2, median: 40, p95: 40, p99: 40, max: 40, over50: 0, over100: 0 })
  })
  it('keeps only a bounded recent window and safely handles empty input', () => {
    const frames = new ReviewFrames(3)
    expect(frames.summary()).toEqual({ samples: 0, median: null, p95: null, p99: null, max: null, over50: 0, over100: 0 })
    for (const now of [10, 20, 40, 70, 110]) frames.record(now, true)
    expect(frames.summary()).toEqual({ samples: 3, median: 30, p95: 40, p99: 40, max: 40, over50: 0, over100: 0 })
    expect(frames.raw()).toEqual([20, 30, 40])
    frames.record(NaN, true); frames.record(10000, true)
    expect(frames.summary().samples).toBe(3)
  })

  it('waits for coverage, freezes hidden travel, and stops at the same fixed endpoint', () => {
    const elements: { textContent?: string; onclick?: (() => void) | null; style: object; append: () => void; remove: () => void }[] = []
    vi.stubGlobal('document', { createElement: () => {
      const el = { style: {}, append: vi.fn(), remove: vi.fn() }; elements.push(el); return el
    }, body: { append: vi.fn() } })
    vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 720)
    try {
      const launch = vi.fn(), review = new FlightReview(20, launch)
      const aircraft = { controls: createDefaultControls(), position: new Vector3(), velocity: new Vector3(),
        angularVelocity: new Vector3(), orientation: new Quaternion(), reset: vi.fn() } as unknown as Aircraft
      const stream = { loaded: 500, pending: 0, inFlight: 0, ready: 0, workers: 4 }
      elements[1]!.onclick!(); expect(launch).toHaveBeenCalledOnce()
      review.visibility(true); review.beforeStep(aircraft); review.afterStep(aircraft, 1)
      expect(aircraft.velocity.length()).toBe(0)
      review.frame(100, stream, 'balanced', 1, 500, 3)
      review.beforeStep(aircraft); review.afterStep(aircraft, 1)
      expect(aircraft.controls.boost).toBe(true)
      expect(aircraft.position.y).toBe(5000)
      expect(aircraft.velocity.length()).toBeCloseTo(680)
      const position = aircraft.position.clone()
      review.visibility(false); review.beforeStep(aircraft); review.afterStep(aircraft, 10)
      expect(aircraft.position).toEqual(position)
      expect(aircraft.controls.boost).toBe(false)
      review.visibility(true); review.afterStep(aircraft, 119)
      review.frame(200, stream, 'balanced', 1, 500, 3, 'external')
      expect(JSON.parse(elements[2]!.textContent!)).toMatchObject({ phase: 'finished', camera: 'external', quality: 'balanced' })
      expect(Math.hypot(aircraft.position.x, aircraft.position.z)).toBeCloseTo(81600)
      review.afterStep(aircraft, 10)
      expect(aircraft.velocity.length()).toBe(0)
      expect(Math.hypot(aircraft.position.x, aircraft.position.z)).toBeCloseTo(81600)
      review.dispose(); expect(elements[0]!.remove).toHaveBeenCalledOnce()
      const long = new FlightReview(20, launch, 900)
      expect(elements[4]!.textContent).toContain('900-second')
      elements[4]!.onclick!(); long.visibility(true)
      long.frame(100, stream, 'balanced', 1, 500, 3)
      long.afterStep(aircraft, 900); long.frame(200, stream, 'balanced', 1, 510, 3)
      const result = JSON.parse(elements[5]!.textContent!)
      expect(result).toMatchObject({ phase: 'finished', durationSeconds: 900, distanceM: 612000 })
      expect(result.route.id).toBe('world'); expect(result.settlements).toBeNull()
      expect(result.resourceSamples).toEqual([
        { seconds: 0, heapBytes: 0, geometries: 500, textures: 3, loaded: 500, pending: 0, inFlight: 0, ready: 0,
          settlements: 0, buildings: 0, roads: 0, settlementPending: 0 },
        { seconds: 900, heapBytes: 0, geometries: 510, textures: 3, loaded: 500, pending: 0, inFlight: 0, ready: 0,
          settlements: 0, buildings: 0, roads: 0, settlementPending: 0 },
      ])
      long.dispose()
    } finally { vi.unstubAllGlobals() }
  })

  it('measures the same fixed city corridor, bounded resource samples and settlement peaks', () => {
    const elements: { textContent?: string; onclick?: (() => void) | null; style: object; append: () => void; remove: () => void }[] = []
    vi.stubGlobal('document', { createElement: () => {
      const el = { style: {}, append: vi.fn(), remove: vi.fn() }; elements.push(el); return el
    }, body: { append: vi.fn() } })
    vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 720)
    try {
      const review = new FlightReview(20, vi.fn(), 900, 'city')
      const aircraft = { controls: createDefaultControls(), position: new Vector3(), velocity: new Vector3(),
        angularVelocity: new Vector3(), orientation: new Quaternion(), reset: vi.fn() } as unknown as Aircraft
      const stream = { loaded: 500, pending: 0, inFlight: 0, ready: 0, workers: 4 }
      const settlements = { loaded: 2, buildings: 1400, roads: 4, pending: 7 }
      elements[1]!.onclick!(); review.visibility(true); review.beforeStep(aircraft)
      expect(aircraft.reset).toHaveBeenCalledWith({ x: 18000, y: 5000, z: 35000, yaw: Math.PI / 2 })
      review.frame(100, stream, 'balanced', 1, 500, 3, 'external', settlements)
      settlements.loaded = 1; settlements.buildings = 700; settlements.roads = 1; settlements.pending = 2
      for (let i = 1; i <= 30; i++) {
        review.afterStep(aircraft, 30)
        review.frame(100 + i * 30000, stream, 'balanced', 1, 500, 3, 'cockpit', settlements)
      }
      const result = JSON.parse(elements[2]!.textContent!)
      expect(result).toMatchObject({ phase: 'finished', route: { id: 'city' }, camera: 'cockpit',
        settlements: { current: settlements, peak: { loaded: 2, buildings: 1400, roads: 4, pending: 7 } } })
      expect(result.resourceSamples).toHaveLength(31)
      expect(result.resourceSamples[0]).toMatchObject({ seconds: 0, settlements: 2, buildings: 1400, roads: 4, settlementPending: 7 })
      expect(result.resourceSamples[30]).toMatchObject({ seconds: 900, settlements: 1, buildings: 700, roads: 1 })
      expect(aircraft.position).toEqual(new Vector3(630000, 5000, 35000))
      expect(aircraft.velocity).toEqual(new Vector3(680, 0, 0))
      review.dispose()
    } finally { vi.unstubAllGlobals() }
  })

  it('keeps terrain following opt-in and falls back safely from an unknown route', () => {
    const elements: { textContent?: string; onclick?: (() => void) | null; style: object; append: () => void; remove: () => void }[] = []
    vi.stubGlobal('document', { createElement: () => {
      const el = { style: {}, append: vi.fn(), remove: vi.fn() }; elements.push(el); return el
    }, body: { append: vi.fn() } })
    const sample = vi.spyOn(terrain, 'sampleTerrainHeight').mockImplementation(x => x / 1000)
    try {
      const aircraft = { controls: createDefaultControls(), position: new Vector3(), velocity: new Vector3(),
        angularVelocity: new Vector3(), orientation: new Quaternion(), reset: vi.fn() } as unknown as Aircraft
      const low = new FlightReview(20, vi.fn(), 120, 'city-low')
      elements[1]!.onclick!(); low.beforeStep(aircraft); low.afterStep(aircraft, 1)
      expect(aircraft.position).toEqual(new Vector3(18000, 518, 35000))
      low.dispose(); sample.mockClear()
      const normal = new FlightReview(20, vi.fn(), 120, '__proto__')
      elements[4]!.onclick!(); normal.beforeStep(aircraft); normal.afterStep(aircraft, 1)
      expect(aircraft.position).toEqual(new Vector3(0, 5000, 0)); expect(sample).not.toHaveBeenCalled()
      normal.dispose()
    } finally { vi.restoreAllMocks(); vi.unstubAllGlobals() }
  })
})
