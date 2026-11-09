import { describe, expect, it } from 'vitest'
import type { FlightSample } from '../src/systems/operation/samples'
import { operationTracePath } from '../src/ui/operation/trace'
import { operationStepsPerFrame, operationReplayStepsPerFrame } from '../src/ui/operation/pace'
import { OPERATION_PLAY_SEED } from '../src/ui/operation/playSeed'

function sample(z: number, y: number): FlightSample {
  return { t: z, x: 0, y, z, speed: 100, clearance: 80, airborne: true }
}

describe('operation trace and pace', () => {
  it('returns an empty path when nothing has been flown', () => {
    expect(operationTracePath([])).toBe('')
  })

  it('starts at the first sample and ends at the last', () => {
    const path = operationTracePath([sample(0, 100), sample(100, 200), sample(200, 150)])
    expect(path.startsWith('M8.0 152.0')).toBe(true)
    expect(path.endsWith('632.0 80.0')).toBe(true)
  })

  it('draws a higher altitude further up the view', () => {
    const path = operationTracePath([sample(0, 100), sample(10, 300)])
    const ys = [...path.matchAll(/[\d.]+ ([\d.]+)/g)].map(match => Number(match[1]))
    expect(ys[1]).toBeLessThan(ys[0]!)
  })

  it('keeps a long trace inside the view box', () => {
    const samples = Array.from({ length: 2000 }, (_, index) => sample(index, 100 + (index % 50)))
    const path = operationTracePath(samples)
    const points = path.split(' ').length
    expect(points).toBeLessThan(2000)
    expect(path.startsWith('M')).toBe(true)
  })

})
