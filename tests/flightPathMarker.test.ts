import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  shouldShowFlightPathMarker,
  writeFlightPathMarker,
  type FlightPathMarkerPosition,
} from '../src/camera/FlightPathMarker'

function marker(): FlightPathMarkerPosition {
  return { x: 50, y: 50, visible: false }
}

function camera(): PerspectiveCamera {
  const value = new PerspectiveCamera(70, 1, 0.1, 1000)
  value.position.set(0, 0, 0)
  value.lookAt(0, 0, -1)
  value.updateProjectionMatrix()
  value.updateMatrixWorld()
  return value
}

describe('flight path marker projection', () => {
  it('keeps the cockpit cue available but gates external drift by flight state', () => {
    expect(shouldShowFlightPathMarker(true, true, 0)).toBe(true)
    expect(shouldShowFlightPathMarker(false, true, 120)).toBe(false)
    expect(shouldShowFlightPathMarker(false, false, 59.9)).toBe(false)
    expect(shouldShowFlightPathMarker(false, false, 60)).toBe(true)
    expect(shouldShowFlightPathMarker(false, false, Number.NaN)).toBe(false)
  })

  it('centers a forward velocity vector', () => {
    const out = marker()
    writeFlightPathMarker(camera(), new Vector3(), new Vector3(0, 0, -100), out)
    expect(out.visible).toBe(true)
    expect(out.x).toBeCloseTo(50)
    expect(out.y).toBeCloseTo(50)
  })

  it('moves with lateral and vertical drift', () => {
    const out = marker()
    writeFlightPathMarker(camera(), new Vector3(), new Vector3(25, 18, -100), out)
    expect(out.visible).toBe(true)
    expect(out.x).toBeGreaterThan(50)
    expect(out.y).toBeLessThan(50)
  })

  it('hides for a stationary or rearward vector', () => {
    const out = marker()
    writeFlightPathMarker(camera(), new Vector3(), new Vector3(0, 0, 0), out)
    expect(out.visible).toBe(false)
    writeFlightPathMarker(camera(), new Vector3(), new Vector3(0, 0, 100), out)
    expect(out.visible).toBe(false)
  })

  it('clamps an off-axis vector to the readable HUD edge', () => {
    const out = marker()
    writeFlightPathMarker(camera(), new Vector3(), new Vector3(1000, 0, -100), out)
    expect(out.visible).toBe(true)
    expect(out.x).toBe(94)
    expect(out.y).toBeCloseTo(50)
  })
})
