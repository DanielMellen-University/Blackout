import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  MathUtils,
} from 'three'

const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _mat = new Matrix4()
const _Y = new Vector3(0, 1, 0)
const windsockState = new WeakMap<Group, { angle: number; speed: number }>()

interface PapiState {
  readonly group: Group
  readonly lenses: readonly Mesh[]
  lastPattern: number
  lastDaylight: number
}

interface BuiltPapi {
  readonly group: Group
  readonly lenses: readonly Mesh[]
}

const airfieldPapiState = new WeakMap<Group, PapiState>()
const runwayPapiState = new WeakMap<Group, PapiState>()

/** Axis-aligned box in runway-local metres (origin at pad centre). */
export interface LocalBox {
  cx: number
  cy: number
  cz: number
  hx: number
  hy: number
  hz: number
}

/**
 * Solid airfield obstacles. Half-extents include a little fuselage padding
 * so an origin-only aircraft query still hits hangar / tower / shack.
 */
export const AIRFIELD_COLLIDERS: readonly LocalBox[] = [
  { cx: 39.2, cy: 5.8, cz: 2, hx: 18, hy: 6.2, hz: 12.2 },
  { cx: 20.5, cy: 10, cz: -46, hx: 5.2, hy: 10.4, hz: 5.2 },
  { cx: 16.5, cy: 1.7, cz: -32, hx: 4.2, hy: 1.8, hz: 3.4 },
]

/**
 * Ops-pad dress: hangar, tower, apron, PAPI, windsock.
 * Local frame matches the runway: +Z takeoff, +X right of heading.
 */
export function createAirfieldLandmarks(): Group {
  const root = new Group()
  root.name = 'Airfield'

  const mat = makeMaterials()

  root.add(buildApron(mat))
  root.add(buildHangar(mat))
  root.add(buildTower(mat))
  root.add(buildShack(mat))
  root.add(buildWindsock(mat))
  const papi = buildPapi(mat)
  root.add(papi.group)
  airfieldPapiState.set(root, { ...papi, lastPattern: -1, lastDaylight: Number.NaN })
  root.add(buildFloods(mat))
  root.add(buildFence(mat))
  root.add(buildApronLights(mat))
  freezeStaticAirfieldMeshes(root)

  return root
}

interface Mats {
  concrete: MeshStandardMaterial
  concreteDark: MeshStandardMaterial
  metal: MeshStandardMaterial
  metalDark: MeshStandardMaterial
  glass: MeshStandardMaterial
  bay: MeshStandardMaterial
  paint: MeshStandardMaterial
  sock: MeshStandardMaterial
  whiteLite: MeshStandardMaterial
  redLite: MeshStandardMaterial
  amberLite: MeshStandardMaterial
  mintLite: MeshStandardMaterial
}

function makeMaterials(): Mats {
  return {
    concrete: solid(0x6a7076, 0.06, 0.92),
    concreteDark: solid(0x4a5056, 0.05, 0.9),
    metal: solid(0x8a929a, 0.22, 0.55),
    metalDark: solid(0x3a4046, 0.28, 0.48),
    glass: new MeshStandardMaterial({
      color: 0x1a2830,
      metalness: 0.12,
      roughness: 0.12,
      emissive: 0x3dcea8,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.78,
    }),
    bay: new MeshStandardMaterial({
      color: 0x0c1014,
      metalness: 0.04,
      roughness: 0.95,
      emissive: 0x2a1810,
      emissiveIntensity: 0.18,
    }),
    paint: solid(0xc8c4b8, 0.04, 0.78),
    sock: new MeshStandardMaterial({
      color: 0xd45a18,
      roughness: 0.7,
      metalness: 0.02,
      emissive: 0x6a2208,
      emissiveIntensity: 0.15,
    }),
    whiteLite: lite(0xf4f8ff, 0xaaccff, 1.4),
    redLite: lite(0xff4030, 0xff2010, 1.6),
    amberLite: lite(0xffc040, 0xff8a18, 1.35),
    mintLite: lite(0xc8f0e0, 0x3dcea8, 1.15),
  }
}

function solid(color: number, metal: number, rough: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    metalness: metal,
    roughness: rough,
  })
}

function lite(color: number, emissive: number, intensity: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.08,
  })
}

function box(
  geo: BoxGeometry,
  mat: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
): Mesh {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  if (sx !== 1 || sy !== 1 || sz !== 1) m.scale.set(sx, sy, sz)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function buildApron(mat: Mats): Group {
  const g = new Group()
  g.name = 'Apron'

  const pad = new Mesh(new PlaneGeometry(28, 62), mat.concrete)
  pad.rotation.x = -Math.PI / 2
  pad.position.set(23, 0.03, -4)
  pad.receiveShadow = true
  g.add(pad)

  const shoulder = new Mesh(new PlaneGeometry(6, 62), mat.concreteDark)
  shoulder.rotation.x = -Math.PI / 2
  shoulder.position.set(11.2, 0.025, -4)
  shoulder.receiveShadow = true
  g.add(shoulder)

  const lineGeo = new BoxGeometry(0.22, 0.03, 3.4)
  for (let z = -32; z < 24; z += 5.2) {
    const dash = new Mesh(lineGeo, mat.paint)
    dash.position.set(10.4, 0.05, z)
    g.add(dash)
  }

  // Tie-down crosses on the pad
  const arm = new BoxGeometry(1.6, 0.025, 0.12)
  for (const z of [-18, -4, 10] as const) {
    const a = new Mesh(arm, mat.paint)
    a.position.set(22, 0.055, z)
    const b = new Mesh(arm, mat.paint)
    b.position.set(22, 0.055, z)
    b.rotation.y = Math.PI / 2
    g.add(a, b)
  }

  return g
}

function buildHangar(mat: Mats): Group {
  const g = new Group()
  g.name = 'Hangar'
  g.position.set(38, 0, 2)

  const w = 34
  const d = 22
  const h = 11.2

  // Shell sits behind an open bay facing the runway (-X)
  const shell = box(new BoxGeometry(w - 2.4, h, d), mat.metal, 1.2, h / 2, 0)
  g.add(shell)

  // Dark bay cavity
  const bay = box(new BoxGeometry(3.2, h - 1.4, d - 3.2), mat.bay, -w / 2 + 2.4, (h - 1.4) / 2 + 0.2, 0)
  bay.castShadow = false
  g.add(bay)

  // Door tracks / jambs
  const jambGeo = new BoxGeometry(0.7, h, 0.7)
  g.add(box(jambGeo, mat.metalDark, -w / 2 + 0.9, h / 2, d / 2 - 0.5))
  g.add(box(jambGeo, mat.metalDark, -w / 2 + 0.9, h / 2, -d / 2 + 0.5))

  // Partly rolled door (reads as a working hangar, not a sealed box)
  const door = box(
    new BoxGeometry(0.35, h * 0.42, d - 2.2),
    mat.metalDark,
    -w / 2 + 1.05,
    h - h * 0.21,
    0,
  )
  g.add(door)

  // Slight roof peak
  const roofL = box(new BoxGeometry(w * 0.52, 0.45, d + 1.4), mat.metalDark, -w * 0.12, h + 0.7, 0)
  roofL.rotation.z = 0.12
  const roofR = box(new BoxGeometry(w * 0.52, 0.45, d + 1.4), mat.metalDark, w * 0.18, h + 0.7, 0)
  roofR.rotation.z = -0.12
  g.add(roofL, roofR)

  // Roof vents
  const ventGeo = new CylinderGeometry(0.55, 0.55, 0.7, 8)
  for (const z of [-6, 0, 6] as const) {
    const v = new Mesh(ventGeo, mat.metal)
    v.position.set(4, h + 1.35, z)
    v.castShadow = true
    g.add(v)
  }

  // Side office strip with glass
  g.add(box(new BoxGeometry(8, 3.2, 0.35), mat.glass, -4, 2.2, d / 2 + 0.15))
  g.add(box(new BoxGeometry(8, 0.35, 0.5), mat.metalDark, -4, 3.9, d / 2 + 0.2))

  // Chevrons on the gable (no text)
  const chev = new BoxGeometry(2.4, 0.35, 0.2)
  for (let i = 0; i < 3; i++) {
    const c = new Mesh(chev, mat.paint)
    c.position.set(-w / 2 + 0.2, 7.2 - i * 0.7, 0)
    c.rotation.y = Math.PI / 2
    g.add(c)
  }

  return g
}

function buildTower(mat: Mats): Group {
  const g = new Group()
  g.name = 'Tower'
  g.position.set(20.5, 0, -46)

  const shaft = box(new BoxGeometry(4.2, 16, 4.2), mat.concreteDark, 0, 8, 0)
  g.add(shaft)

  // Stair-rib on the shaft
  g.add(box(new BoxGeometry(0.35, 15, 1.4), mat.metalDark, 2.2, 7.6, 0))

  const cab = box(new BoxGeometry(8.4, 3.4, 8.4), mat.metal, 0, 17.6, 0)
  g.add(cab)
  const glass = box(new BoxGeometry(7.6, 2.4, 7.6), mat.glass, 0, 17.7, 0)
  glass.castShadow = false
  g.add(glass)

  const roof = box(new BoxGeometry(9.2, 0.35, 9.2), mat.metalDark, 0, 19.5, 0)
  g.add(roof)

  // Mast + dishes
  const mast = new Mesh(new CylinderGeometry(0.12, 0.16, 6.2, 6), mat.metal)
  mast.position.set(0, 22.7, 0)
  mast.castShadow = true
  g.add(mast)
  const dish = new Mesh(new CylinderGeometry(0.9, 0.9, 0.12, 12), mat.metalDark)
  dish.position.set(0.8, 21.4, 0)
  dish.rotation.z = 0.5
  g.add(dish)

  const beacon = new Mesh(new SphereGeometry(0.22, 8, 6), mat.redLite)
  beacon.position.set(0, 26.1, 0)
  g.add(beacon)

  return g
}

function buildShack(mat: Mats): Group {
  const g = new Group()
  g.name = 'Shack'
  g.position.set(16.5, 0, -32)

  g.add(box(new BoxGeometry(6.4, 3.1, 4.8), mat.metalDark, 0, 1.55, 0))
  g.add(box(new BoxGeometry(6.9, 0.22, 5.3), mat.metal, 0, 3.22, 0))
  g.add(box(new BoxGeometry(2.4, 1.4, 0.12), mat.glass, -1.2, 1.7, 2.42))
  g.add(box(new BoxGeometry(1.1, 2.1, 0.12), mat.metal, 2.0, 1.15, 2.42))

  return g
}

function buildWindsock(mat: Mats): Group {
  const g = new Group()
  g.name = 'Windsock'
  g.position.set(14.2, 0, -54)

  const pole = new Mesh(new CylinderGeometry(0.09, 0.12, 8.2, 6), mat.metal)
  pole.position.y = 4.1
  pole.castShadow = true
  g.add(pole)

  const sock = new Mesh(new ConeGeometry(0.55, 2.6, 7, 1, true), mat.sock)
  sock.name = 'WindsockFabric'
  sock.geometry.rotateX(-Math.PI / 2)
  sock.position.set(0.2, 7.55, 1.15)
  sock.rotation.y = 0.18
  sock.rotation.x = 0.12
  sock.castShadow = true
  g.add(sock)

  const hoop = new Mesh(new CylinderGeometry(0.58, 0.58, 0.08, 10), mat.metalDark)
  hoop.position.set(0.05, 7.7, 0.15)
  hoop.rotation.x = Math.PI / 2
  g.add(hoop)

  return g
}

/** Drive the existing windsock from world wind without rebuilding its mesh. */
export function setAirfieldWind(root: Group, windX: number, windZ: number): void {
  const windsock = root.getObjectByName('Windsock')
  if (!(windsock instanceof Group)) return
  const sock = windsock.getObjectByName('WindsockFabric')
  if (!(sock instanceof Mesh)) return

  const wx = Number.isFinite(windX) ? windX : 0
  const wz = Number.isFinite(windZ) ? windZ : 0
  const yaw = root.rotation.y
  // Convert world wind into runway-local axes before aiming the fabric.
  const localX = Math.cos(yaw) * wx - Math.sin(yaw) * wz
  const localZ = Math.sin(yaw) * wx + Math.cos(yaw) * wz
  const magnitude = Math.hypot(localX, localZ)
  const speed = MathUtils.clamp(magnitude / 31, 0, 1)
  // The cone's local axis points toward -Z after its construction rotation,
  // so aim that axis downwind rather than into the incoming flow.
  const angle = magnitude > 1e-4 ? Math.atan2(-localX, -localZ) : 0
  const previous = windsockState.get(root)
  if (
    previous &&
    Math.abs(angleDelta(previous.angle, angle)) < 0.004 &&
    Math.abs(previous.speed - speed) < 0.004
  ) return
  windsockState.set(root, { angle, speed })
  windsock.rotation.y = angle
  sock.rotation.x = 0.12 + speed * 0.18
  sock.scale.set(1, 0.84 + speed * 0.28, 1)
}

/**
 * Freeze local matrices for airfield geometry that never animates. Parent
 * runway transforms still propagate normally; the windsock fabric remains
 * live because its rotation and extension are driven by weather.
 */
export function freezeStaticAirfieldMeshes(root: Group): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh) || object.name === 'WindsockFabric') return
    object.updateMatrix()
    object.matrixAutoUpdate = false
  })
}

/**
 * Pick the four-light PAPI pattern from the aircraft's approach angle.
 * The return value is the number of white lenses, from 0 (all red) to 4
 * (all white). Invalid inputs resolve to a level two-white/two-red cue.
 */
export function papiLightPattern(height: number, distance: number): number {
  if (!Number.isFinite(height) || !Number.isFinite(distance)) return 2
  const safeHeight = Math.max(0, height)
  const safeDistance = Math.max(1, distance)
  const angleDeg = Math.atan2(safeHeight, safeDistance) * 180 / Math.PI
  if (angleDeg >= 3.5) return 4
  if (angleDeg >= 3) return 3
  if (angleDeg >= 2.5) return 2
  if (angleDeg >= 1.8) return 1
  return 0
}

/** Keep approach lights readable at night without overpowering daylight. */
export function papiLightIntensity(daylight: number, white: boolean): number {
  const safeDaylight = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 1
  const nightBoost = 0.72 + (1 - safeDaylight) * 0.75
  return (white ? 1.4 : 1.6) * nightBoost
}

/**
 * Drive the runway PAPI from the aircraft's world position. Approach geometry
 * is resolved in runway-local space so the cue remains correct on rotated pads.
 */
export function setAirfieldPapi(
  root: Group,
  x: number,
  y: number,
  z: number,
  daylight = 1,
): void {
  let state = runwayPapiState.get(root)
  if (!state) {
    state = airfieldPapiState.get(root)
    if (!state) {
      const airfield = root.getObjectByName('Airfield')
      if (airfield instanceof Group) state = airfieldPapiState.get(airfield)
    }
    if (state) runwayPapiState.set(root, state)
  }
  if (!state) return

  const wx = Number.isFinite(x) ? x : root.position.x
  const wy = Number.isFinite(y) ? y : root.position.y
  const wz = Number.isFinite(z) ? z : root.position.z
  const dx = wx - root.position.x
  const dz = wz - root.position.z
  const yaw = root.rotation.y
  const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz
  const localZ = Math.sin(yaw) * dx + Math.cos(yaw) * dz

  const papiX = -13.5
  const papiZ = -38
  // The PAPI is mounted at the near (-Z) threshold and faces incoming
  // aircraft on that side of the strip.
  const along = papiZ - localZ
  const lateral = localX - papiX
  // Outside the landing corridor, hold a neutral two-white/two-red pattern so
  // distant fly-bys do not make the approach lights flash unpredictably.
  const inApproach = along > 8 && along < 1200 && Math.abs(lateral) < 100
  const distance = Math.hypot(along, lateral)
  const pattern = inApproach
    ? papiLightPattern(wy - root.position.y, distance)
    : 2
  const safeDaylight = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 1
  if (
    pattern === state.lastPattern &&
    Math.abs(safeDaylight - state.lastDaylight) < 0.01
  ) return
  state.lastPattern = pattern
  state.lastDaylight = safeDaylight

  for (let i = 0; i < state.lenses.length; i++) {
    const lens = state.lenses[i]
    if (!(lens?.material instanceof MeshStandardMaterial)) continue
    const white = i < pattern
    lens.material.color.set(white ? 0xf4f8ff : 0xff4030)
    lens.material.emissive.set(white ? 0xaaccff : 0xff2010)
    lens.material.emissiveIntensity = papiLightIntensity(safeDaylight, white)
  }
}

function buildPapi(mat: Mats): BuiltPapi {
  const g = new Group()
  g.name = 'PAPI'
  g.position.set(-13.5, 0, -38)

  const boxGeo = new BoxGeometry(0.9, 0.45, 0.7)
  const lensGeo = new BoxGeometry(0.62, 0.22, 0.08)
  const lenses: Mesh[] = []
  // Classic 4-box: two white, two red, approaching from -Z
  const colors = [mat.whiteLite, mat.whiteLite, mat.redLite, mat.redLite]
  for (let i = 0; i < 4; i++) {
    const x = i * 1.35
    g.add(box(boxGeo, mat.metalDark, x, 0.28, 0))
    // Each lens gets an owned material so the approach pattern can change
    // without mutating the shared airfield palette.
    const lens = new Mesh(lensGeo, colors[i]!.clone())
    lens.name = `PapiLens${i}`
    lens.position.set(x, 0.32, -0.38)
    lenses.push(lens)
    g.add(lens)
  }

  return { group: g, lenses }
}

function buildFloods(mat: Mats): Group {
  const g = new Group()
  g.name = 'Floods'
  const poleGeo = new CylinderGeometry(0.12, 0.16, 9.5, 6)
  const armGeo = new BoxGeometry(0.16, 0.16, 2.4)
  const headGeo = new BoxGeometry(0.7, 0.28, 0.9)

  for (const [x, z] of [
    [32, -22],
    [32, 8],
    [32, 24],
  ] as const) {
    const pole = new Mesh(poleGeo, mat.metalDark)
    pole.position.set(x, 4.75, z)
    pole.castShadow = true
    const arm = new Mesh(armGeo, mat.metalDark)
    arm.position.set(x - 1.1, 9.35, z)
    const head = new Mesh(headGeo, mat.whiteLite)
    head.position.set(x - 2.1, 9.2, z)
    g.add(pole, arm, head)
  }

  return g
}

function buildFence(mat: Mats): Group {
  const g = new Group()
  g.name = 'Fence'

  const postGeo = new BoxGeometry(0.12, 1.8, 0.12)
  const count = 22
  const mesh = new InstancedMesh(postGeo, mat.metalDark, count)
  mesh.castShadow = true
  for (let i = 0; i < count; i++) {
    const z = -34 + i * 3.1
    _pos.set(51.5, 0.9, z)
    _quat.identity()
    _scale.set(1, 1, 1)
    _mat.compose(_pos, _quat, _scale)
    mesh.setMatrixAt(i, _mat)
  }
  mesh.instanceMatrix.needsUpdate = true
  g.add(mesh)

  const railGeo = new BoxGeometry(0.06, 0.06, count * 3.1 - 1)
  const rail1 = new Mesh(railGeo, mat.metalDark)
  rail1.position.set(51.5, 1.45, -1.5)
  const rail2 = new Mesh(railGeo, mat.metalDark)
  rail2.position.set(51.5, 0.55, -1.5)
  g.add(rail1, rail2)

  return g
}

function buildApronLights(mat: Mats): Group {
  const g = new Group()
  g.name = 'ApronLights'
  const geo = new BoxGeometry(0.22, 0.1, 0.22)
  const n = 16
  const mesh = new InstancedMesh(geo, mat.amberLite, n)
  for (let i = 0; i < n; i++) {
    const z = -30 + i * 3.8
    _pos.set(10.9, 0.08, z)
    _quat.setFromAxisAngle(_Y, 0)
    _scale.set(1, 1, 1)
    _mat.compose(_pos, _quat, _scale)
    mesh.setMatrixAt(i, _mat)
  }
  mesh.instanceMatrix.needsUpdate = true
  g.add(mesh)
  return g
}

function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}
