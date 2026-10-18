// Injected only by the external review script into Vite's transpiled main module.
// Prescribe the approach before each real physics step, then let production
// ground resolution, collision, scoring, HUD, lights and rendering run normally.
const landingReviewState = { active: false, held: false, seconds: 0, nextSample: 0, samples: [], contact: null, noseDelta: 0, trackDelta: 0 }
const landingReviewAxis = new Vector3(0, 1, 0)
const landingReviewPitchAxis = new Vector3(1, 0, 0)
const landingReviewPitch = new Quaternion()
const landingReviewRunway = world.runway
let landingReviewRoute = []
const landingReviewHeight = z => {
  if (z >= -100) return Math.max(1.35, 1.35 + (-20 - z) * (landingReviewRoute.at(-1).height - 1.35) / 80)
  const q = Math.max(0, Math.min(89.999999, (z + 1000) / 10)), i = Math.floor(q), f = q - i
  return landingReviewRoute[i].height + (landingReviewRoute[i + 1].height - landingReviewRoute[i].height) * f
}
const landingReviewSnapshot = () => {
  const p = aircraft.position, runway = landingReviewRunway, yaw = runway.rotation.y
  const dx = p.x - runway.position.x, dz = p.z - runway.position.z
  const pose = attitudeFromOrientation(aircraft.orientation)
  const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz
  const localZ = Math.sin(yaw) * dx + Math.cos(yaw) * dz
  const lights = [0, 1, 2, 3].map(i => runway.getObjectByName('PapiLens' + i)?.material.color.g > .5)
  return { seconds: landingReviewState.seconds, seed: world.worldSeed, course: activeSortie.course.id,
    position: p.toArray(), velocity: aircraft.velocity.toArray(), heading: pose.heading, pitch: pose.pitch,
    localX, localZ, height: p.y - runway.position.y, onGround: aircraft.onGround,
    playing, paused: menu.paused, hidden: document.hidden, active: landingReviewState.active, status: aircraft.status, phase: challenge.phase, camera: cameras.mode, ratio: renderer.getPixelRatio(),
    guidance: world.landingGlideCue(p, pose.heading, aircraft.velocity, aircraft.onGround),
    hudGlide: hudFrame.navGlide, hudTarget: hudFrame.navTarget, papiWhite: lights.filter(Boolean).length,
    actualPapi: lights, runway: { position: runway.position.toArray(), yaw },
    contact: landingReviewState.contact, resultsOpen: results.open }
}
window.__landing = {
  state: landingReviewSnapshot,
  samples: () => landingReviewState.samples,
  route: () => landingReviewRoute,
  start: () => {
    world.atmosphere.setWeather('clear', true)
    world.atmosphere.timeOfDay = .5; world.atmosphere.setTimeOfDayLocked(true)
    if (activeSortie.course.id !== 'free-flight') for (let i = 0; i < challenge.totalGates; i++) challenge.recordGate(1)
    landingReviewState.seconds = 0; landingReviewState.nextSample = 0
    landingReviewState.samples = []; landingReviewState.contact = null
    landingReviewState.active = true; landingReviewState.held = false
    const runway = landingReviewRunway, yaw = runway.rotation.y
    landingReviewRoute = []
    for (let z = -1000; z <= -100; z += 10) {
      const x = runway.position.x + Math.sin(yaw) * z, wz = runway.position.z + Math.cos(yaw) * z
      const meshGround = world.terrain.sampleMeshHeight(x, wz)
      const ground = meshGround === null ? null : Math.max(meshGround, landingReviewSurface(x, wz))
      if (ground === null) throw Error('Missing resident approach terrain at ' + z)
      const clearance = z <= -300 ? 8 : 2 + (-100 - z) * .03
      const glide = Math.hypot(-38 - z, 13.5) * Math.tan(2.75 * Math.PI / 180)
      landingReviewRoute.push({ z, x, worldZ: wz, ground, height: Math.max(glide, ground - runway.position.y + clearance) })
    }
    // Clear resolved water as well as the bed and bound prescribed descent.
    // The majorant keeps discontinuous shore samples from commanding a dive.
    for (const p of landingReviewRoute) for (const q of landingReviewRoute)
      p.height = Math.max(p.height, q.height - Math.abs(q.z - p.z) * .25)
    const z = -1000, h = landingReviewHeight(z)
    aircraft.reset({ x: runway.position.x + Math.sin(yaw) * z, y: runway.position.y + h,
      z: runway.position.z + Math.cos(yaw) * z, yaw })
    window.__landing.before(0); aircraft.snapDisplay(); aircraft.capturePrevious()
    wasAirborne = true
    cameras.setMode('chase', aircraft)
  },
  probe: (nose, track) => { landingReviewState.noseDelta = nose * Math.PI / 180; landingReviewState.trackDelta = track * Math.PI / 180 },
  hold: value => { landingReviewState.held = value },
  view: mode => { cameras.setMode(mode, aircraft) },
  before: dt => {
    if (!landingReviewState.active) return
    if (!landingReviewState.held) landingReviewState.seconds += dt
    const t = landingReviewState.seconds, speed = 42, z = -1000 + speed * t
    const runway = landingReviewRunway, yaw = runway.rotation.y
    const h = landingReviewHeight(z)
    const vy = (landingReviewHeight(z + .1) - landingReviewHeight(z - .1)) / .2 * speed
    aircraft.position.set(runway.position.x + Math.sin(yaw) * z, runway.position.y + h,
      runway.position.z + Math.cos(yaw) * z)
    aircraft.orientation.setFromAxisAngle(landingReviewAxis, yaw + landingReviewState.noseDelta)
      .multiply(landingReviewPitch.setFromAxisAngle(landingReviewPitchAxis, -.04))
    aircraft.velocity.set(Math.sin(yaw + landingReviewState.trackDelta) * speed, vy, Math.cos(yaw + landingReviewState.trackDelta) * speed)
    aircraft.angularVelocity.set(0, 0, 0)
    aircraft.controls.pitch = aircraft.controls.roll = aircraft.controls.yaw = 0
    aircraft.controls.throttle = 0; aircraft.controls.boost = false
    aircraft.controls.gearDown = true; aircraft.controls.airbrake = false
    aircraft.controls.stabilityAssist = false
  },
  touch: touch => {
    if (!landingReviewState.active || touch === 'air') return
    landingReviewState.contact = { touch, ...landingReviewSnapshot(),
      impact: aircraft.impact ? { surface: aircraft.impact.surface, verticalVelocity: aircraft.impact.verticalVelocity,
        preImpactVelocity: aircraft.impact.preImpactVelocity.toArray(), startedAirborne: aircraft.impact.startedAirborne } : null,
      failureReason: collision.failureReason }
    landingReviewState.active = false
  },
  frame: () => {
    if (landingReviewState.active && landingReviewState.seconds >= landingReviewState.nextSample) {
      landingReviewState.samples.push(landingReviewSnapshot()); landingReviewState.nextSample += .25
    }
  },
  boundaries: () => {
    const yaw = landingReviewRunway.rotation.y, p = aircraft.position.clone(), v = aircraft.velocity.clone()
    const saved = aircraft.orientation.clone(), cases = []
    for (const degrees of [-31, -30, -29.99, 0, 29.99, 30, 31]) for (const axis of ['nose', 'track']) {
      const a = degrees * Math.PI / 180, heading = yaw + (axis === 'nose' ? a : 0), track = yaw + (axis === 'track' ? a : 0)
      cases.push({ degrees, axis, guidance: world.landingGlideCue(p, heading,
        { x: Math.sin(track) * 42, y: v.y, z: Math.cos(track) * 42 }, false) })
    }
    aircraft.orientation.copy(saved)
    return cases
  },
}
