import { describe, expect, it } from 'vitest'
import { OPERATION_BAND_HEIGHT_M, OPERATION_BAND_WIDTH_M, OperationCourseMarkers, operationMarkerLayout } from '../src/systems/operation/markers'
import { lateralForSeed } from '../src/systems/operation/gates'
import { stageAltitude } from '../src/systems/operation/bands'
import { Mesh } from 'three'

describe('operation markers', () => {
  it('puts the ingress gates and the briefed band on the scored line', () => {
    const layout = operationMarkerLayout(42, null, null, 'ingress')
    const altitude = stageAltitude('ingress', null, null)
    expect(layout.gates.map(gate => gate.z)).toEqual([800, 1600, 2400])
    expect(layout.gates.every(gate => gate.kind === 'live' && gate.x === lateralForSeed(42) && gate.y === altitude)).toBe(true)
    const walls = layout.bands.filter(item => item.kind === 'live')
    expect(walls).toHaveLength(2)
    expect(walls.every(wall => wall.y === altitude && wall.height === OPERATION_BAND_HEIGHT_M)).toBe(true)
    const lateral = lateralForSeed(42)
    expect(Math.min(...walls.map(wall => wall.x))).toBeLessThan(lateral)
    expect(Math.max(...walls.map(wall => wall.x))).toBeGreaterThan(lateral)
    expect(walls[0]!.z - walls[0]!.length / 2).toBeGreaterThan(-200)
    expect(walls[0]!.z + walls[0]!.length / 2).toBe(2400)
  })

  it('shows the valley band below the ridge band while the route is open', () => {
    const layout = operationMarkerLayout(42, null, null, 'route-choice')
    const valley = layout.bands.find(item => item.kind === 'valley')
    const ridge = layout.bands.find(item => item.kind === 'ridge')
    expect(valley?.y).toBe(stageAltitude('transit', 'valley', null))
    expect(ridge?.y).toBe(stageAltitude('transit', 'ridge', null))
    expect(valley!.y).toBeLessThan(ridge!.y)
    expect(layout.gates.filter(gate => gate.kind === 'valley')).toHaveLength(3)
    expect(layout.gates.filter(gate => gate.kind === 'ridge')).toHaveLength(3)
  })

  it('builds rings and a band mesh the cockpit can see', () => {
    const markers = new OperationCourseMarkers()
    markers.sync(42, null, null, 'ingress')
    expect(markers.root.visible).toBe(true)
    const gates = markers.root.children.filter(child => child.name === 'operation-gate')
    const band = markers.root.children.find(child => child.name === 'operation-band')
    expect(gates).toHaveLength(3)
    expect(gates[0]).toBeInstanceOf(Mesh)
    expect(gates.map(gate => gate.position.z)).toEqual([800, 1600, 2400])
    expect(band?.position.y).toBe(stageAltitude('ingress', null, null))
    markers.sync(42, null, null, 'results')
    expect(markers.root.visible).toBe(true)
    markers.hide()
    expect(markers.root.visible).toBe(false)
    markers.dispose()
  })
})