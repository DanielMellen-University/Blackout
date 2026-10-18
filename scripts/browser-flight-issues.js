// Static reproductions of recorded real-flight poses. This fixture alone holds
// a pose; the endurance evidence uses the separate controls-only pilot.
const issueHold = { sample: null, orientation: new Quaternion() }
window.__issues = {
  place: s => {
    issueHold.sample = s
    aircraft.reset({ x: s.position[0], y: s.position[1], z: s.position[2], yaw: s.attitude.heading })
    issueHold.orientation.copy(aircraft.orientation)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -s.attitude.pitch))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -s.attitude.roll))
    world.atmosphere.timeOfDay = s.timeOfDay ?? (issueSeedTime(world.worldSeed) + (s.seconds + 5) / 480) % 1
    world.atmosphere.setTimeOfDayLocked(true)
    world.atmosphere.regionalElapsed = s.seconds + 5
    world.atmosphere.regionalSampleTime = -Infinity
    world.atmosphere.weatherSnapshotDirty = true
    cameras.setMode('chase', aircraft)
    window.__issues.before(); aircraft.snapDisplay(); aircraft.capturePrevious(); wasAirborne = true
  },
  before: () => {
    const s = issueHold.sample; if (!s) return
    aircraft.position.fromArray(s.position); aircraft.velocity.fromArray(s.velocity)
    aircraft.orientation.copy(issueHold.orientation); aircraft.angularVelocity.set(0, 0, 0)
    const c = aircraft.controls
    c.pitch = c.roll = c.yaw = 0; c.throttle = .45; c.boost = c.airbrake = c.gearDown = c.stabilityAssist = false
  },
  scan: () => {
    const cases = []
    for (const loaded of world.settlements.loaded.values()) for (const b of loaded.plan.buildings) {
      const h = world.terrain.sampleMeshHeight(b.x, b.z)
      cases.push({ id: loaded.plan.id, kind: loaded.plan.kind, x: b.x, z: b.z, base: b.y, rendered: h,
        analytic: issueTerrain(b.x, b.z), gap: h === null ? null : b.y - h, visible: loaded.root.visible })
    }
    cases.sort((a, b) => (b.gap ?? Infinity) - (a.gap ?? Infinity))
    return { cases, terrain: world.terrain.streamingStats, position: aircraft.position.toArray(),
      timeOfDay: world.atmosphere.timeOfDay, weather: { ...world.atmosphere.weatherSnapshot },
      engine: { ...aircraft.engineState }, plumeScale: aircraft.afterburner?.scale.toArray() }
  },
}
