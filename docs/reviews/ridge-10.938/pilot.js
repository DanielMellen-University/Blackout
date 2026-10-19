// External controls-only pilot. Reset once before the measured flight; after
// launch only control axes change. Production physics owns every pose/contact.
const endurance = { active: false, seconds: 0, yaw: 0, target: 0, nextSurvey: 0, start: null }
const enduranceClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
window.__endurance = {
  start: () => {
    endurance.yaw = world.spawn.yaw + .7
    const x = world.spawn.x, z = world.spawn.z
    aircraft.reset({ x, y: enduranceSurface(x, z) + 450, z, yaw: endurance.yaw })
    aircraft.velocity.set(Math.sin(endurance.yaw) * 160, 0, Math.cos(endurance.yaw) * 160)
    aircraft.snapDisplay(); aircraft.capturePrevious(); wasAirborne = true
    endurance.seconds = 0; endurance.nextSurvey = 0; endurance.active = true
    endurance.start = aircraft.position.toArray()
    cameras.setMode('chase', aircraft)
  },
  before: dt => {
    if (!endurance.active) return
    endurance.seconds += dt
    const pose = attitudeFromOrientation(aircraft.orientation), p = aircraft.position
    if (endurance.seconds >= endurance.nextSurvey) {
      endurance.nextSurvey = endurance.seconds + .5
      endurance.target = -Infinity
      for (const d of [0, 300, 600, 1000, 1500, 2200, 3000]) {
        const x = p.x + Math.sin(endurance.yaw) * d, z = p.z + Math.cos(endurance.yaw) * d
        endurance.target = Math.max(endurance.target, enduranceSurface(x, z) + 220 - d * .025)
      }
    }
    const desired = enduranceClamp(Math.atan2(endurance.target - p.y, 1800), -.22, .35)
    const error = Math.atan2(Math.sin(endurance.yaw - pose.heading), Math.cos(endurance.yaw - pose.heading))
    const c = aircraft.controls
    c.pitch = enduranceClamp((desired - pose.pitch) * 2 + aircraft.angularVelocity.x * .4, -1, 1)
    c.roll = enduranceClamp(-pose.roll * 2 + aircraft.angularVelocity.z * .4, -1, 1)
    c.yaw = enduranceClamp(error * 1.8 - aircraft.angularVelocity.y * .4, -1, 1)
    c.throttle = .45; c.boost = false; c.airbrake = false; c.gearDown = false; c.stabilityAssist = true
  },
  state: () => ({ seconds: endurance.seconds, seed: world.worldSeed, course: activeSortie.course.id,
    position: aircraft.position.toArray(), velocity: aircraft.velocity.toArray(),
    start: endurance.start, heading: endurance.yaw, targetHeight: endurance.target,
    status: aircraft.status, onGround: aircraft.onGround, agl: aircraft.altitudeAgl,
    attitude: { ...attitudeFromOrientation(aircraft.orientation) },
    weather: { ...world.atmosphere.weatherState }, hudGlide: hudFrame.navGlide,
    hudTarget: hudFrame.navTarget, paused: menu.paused, playing,
    heapBytes: performance.memory?.usedJSHeapSize ?? 0,
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
    streaming: { ...world.terrain.streamingStats }, settlements: world.settlements?.reviewStats?.() ?? null,
    ratio: renderer.getPixelRatio(), camera: cameras.mode,
  }),
}

// Read-only contact instrumentation, applied to the preserved pilot above.
const ridgeDiagnostic = { contact: null, recent: [] }
const ridgeOriginalState = window.__endurance.state
const ridgeOriginalBefore = window.__endurance.before
let ridgeNextSample = 570
const ridgeSample = () => ({ ...ridgeOriginalState(), controls: { ...aircraft.controls },
  groundHeight: aircraft.groundHeight, analyticSurface: enduranceSurface(aircraft.position.x, aircraft.position.z),
  residentHeight: world.terrain.sampleMeshHeight(aircraft.position.x, aircraft.position.z) })
window.__endurance.before = dt => {
  ridgeOriginalBefore(dt)
  if (endurance.seconds >= ridgeNextSample) {
    ridgeNextSample = endurance.seconds + .5
    ridgeDiagnostic.recent.push(ridgeSample())
    if (ridgeDiagnostic.recent.length > 160) ridgeDiagnostic.recent.shift()
  }
}
const ridgeCrash = aircraft.crash.bind(aircraft)
aircraft.crash = () => {
  const impact = aircraft.impact
  ridgeDiagnostic.contact = { ...ridgeSample(), failure: collision.failureReason,
    impact: impact ? { point: impact.point.toArray(), surfacePoint: impact.surfacePoint.toArray(),
      normal: impact.surfaceNormal.toArray(), velocity: impact.preImpactVelocity.toArray(),
      normalVelocity: impact.normalVelocity, verticalVelocity: impact.verticalVelocity,
      tangentialSpeed: impact.tangentialSpeed, surface: impact.surface,
      gearDown: impact.gearDown, startedAirborne: impact.startedAirborne } : null,
    forward: [0,100,200,300,500,750,1000,1500,2200,3000,4000,6000,8000].map(d => {
      const x = aircraft.position.x + Math.sin(endurance.yaw) * d
      const z = aircraft.position.z + Math.cos(endurance.yaw) * d
      return { d, x, z, height: enduranceSurface(x,z), resident: world.terrain.sampleMeshHeight(x,z) }
    }) }
  ridgeCrash()
}
window.__endurance.state = () => ({ ...ridgeOriginalState(), diagnostic: ridgeDiagnostic })
