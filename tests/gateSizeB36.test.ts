import { expect, it } from 'vitest'
import { Scene, TorusGeometry, Vector3 } from 'three'
import { MissionSystem } from '../src/systems/Mission'

it.each([
  { profile: 'orbit' as const, previousTrigger: 36, ringScale: 1 },
  { profile: 'slalom' as const, previousTrigger: 38 * .78 - 2, ringScale: .82 },
])('scales visual and trigger gate size together for $profile', ({ profile, previousTrigger, ringScale }) => {
  const mission = new MissionSystem(new Scene())
  try {
    mission.start(0, 100_000, 0, 0, profile)
    const gate = mission.gates[0]!
    const ring = mission.root.getObjectByName('gate_0')!
    const geometry = ring.geometry as TorusGeometry
    expect(geometry.parameters.radius).toBeCloseTo(38 * 1.5)
    expect(geometry.parameters.tube).toBeCloseTo(1.15 * 1.5)
    expect(ring.scale.x).toBeCloseTo(ringScale)
    expect(gate.radius).toBeCloseTo(previousTrigger * 1.5)

    const fwd = gate.fwd
    const previous = gate.pos.clone().addScaledVector(fwd, -10)
    const atNewEdge = gate.pos.clone().addScaledVector(fwd, 10).add(new Vector3(0, gate.radius * .99, 0))
    expect(mission.update(previous.x, previous.y, previous.z)).toBe('none')
    expect(mission.update(atNewEdge.x, atNewEdge.y, atNewEdge.z)).toBe('pass')
  } finally { mission.dispose() }
})
