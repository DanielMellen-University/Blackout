import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CylinderGeometry,
  DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, SphereGeometry, TorusGeometry,
  Vector2, Vector3, type Material,
} from 'three'

type Point = [number, number, number]

/** Original, code-built stealth fighter. Metres; +Z forward, +Y up. */
export function createF35Model(): Group {
  const root = new Group()
  root.name = 'F35'
  const skin = new MeshStandardMaterial({ color: 0x68747d, roughness: 0.58, metalness: 0.38 })
  const upper = new MeshStandardMaterial({ color: 0x879198, roughness: 0.62, metalness: 0.3 })
  const trim = new MeshStandardMaterial({ color: 0x414b54, roughness: 0.7, metalness: 0.25 })
  const seam = new MeshStandardMaterial({ color: 0x303b43, roughness: 0.8 })
  const black = new MeshStandardMaterial({ color: 0x090e13, roughness: 0.85 })
  const metal = new MeshStandardMaterial({ color: 0xa8b3bc, roughness: 0.27, metalness: 0.85 })
  const rubber = new MeshStandardMaterial({ color: 0x11151a, roughness: 0.95 })
  const glass = new MeshStandardMaterial({
    color: 0x594933, emissive: 0x233c50, emissiveIntensity: 0.22,
    metalness: 0.72, roughness: 0.16,
  })

  // Cross sections create the pointed radome, chine, broad engine body and
  // round exhaust transition as one continuous skin, with no intersecting tubes.
  const sections: [number, number, number, number][] = [
    [7.8, 0.035, 0.025, -0.02], [6.8, 0.38, 0.25, -0.2],
    [5.3, 0.72, 0.48, -0.39], [3.8, 1.01, 0.68, -0.52],
    [2.0, 1.31, 0.72, -0.61], [0, 1.4, 0.72, -0.64],
    [-2.2, 1.24, 0.73, -0.59], [-4.1, 1.0, 0.58, -0.51],
    [-5.7, 0.78, 0.49, -0.45], [-6.65, 0.65, 0.48, -0.48],
  ]
  const positions: number[] = []
  const indices: number[] = []
  // Clockwise from above; chine ledge and flat belly are deliberate.
  const ring = [[0, 1], [.55, .92], [.88, .58], [1, .12], [.91, -.55],
    [.58, -.94], [0, -1], [-.58, -.94], [-.91, -.55], [-1, .12],
    [-.88, .58], [-.55, .92]]
  for (const [z, width, top, bottom] of sections) {
    for (const [x, y] of ring) positions.push(x! * width, y! >= 0 ? y! * top : -y! * bottom, z)
  }
  for (let j = 0; j < sections.length - 1; j++) {
    for (let i = 0; i < ring.length; i++) {
      const a = j * ring.length + i
      const b = j * ring.length + (i + 1) % ring.length
      const c = a + ring.length
      const d = b + ring.length
      indices.push(a, b, c, b, d, c)
    }
  }
  const body = new Mesh(geometry(positions, indices), skin)
  body.name = 'BlendedFuselage'
  root.add(body)

  // Radome seam follows the chine, without a dark cartoon nose cap.
  for (const side of [-1, 1]) {
    line(root, [[side * .72, .06, 5.28], [side * .59, .36, 5.28], [0, .485, 5.28]], .014, trim)
    plate(root, [
      [side * .75, .21, 4.8], [side * 1.5, .1, 2.45],
      [side * 2.12, .06, .7], [side * 1.27, .16, -2.7],
      [side * .87, .34, -.8],
    ], .13, skin, 'Chine')

    plate(root, [
      [side * 1.05, .03, 2.0], [side * 5.32, -.04, -1.25],
      [side * 5.28, -.045, -2.13], [side * 2.35, .02, -3.15],
      [side * 1.0, .12, -2.85],
    ], .12, upper, 'MainWing')
    plate(root, [
      [side * 1.85, .10, -2.39], [side * 4.93, -.0, -1.92],
      [side * 4.84, .0, -2.21], [side * 2.38, .075, -3.0],
    ], .035, skin, 'Flaperon')
    line(root, [[side * 1.95, .13, 1.28], [side * 5.18, .025, -1.24]], .022, trim)
    line(root, [[side * 2.38, .12, -3.01], [side * 2.01, .14, -2.35], [side * 4.91, .04, -1.95]], .012, seam)

    plate(root, [
      [side * .73, .12, -3.72], [side * 1.56, .08, -3.58],
      [side * 3.27, -.02, -5.35], [side * 3.15, -.02, -6.06],
      [side * 1.13, .06, -5.75], [side * .64, .1, -5.0],
    ], .1, upper, 'Stabilator')
    // Fins lean outwards as they rise, including the trailing rudder.
    plate(root, [
      [side * .81, .38, -3.25], [side * 1.04, .36, -5.88],
      [side * 2.04, 2.68, -6.12], [side * 1.94, 2.78, -5.25],
    ], .1, skin, 'CantedTail', 'x')
    line(root, [[side * 1.08, .44, -5.35], [side * 1.94, 2.58, -5.74]], .017, trim)

    // Angular side intake, open black throat facing forward.
    plate(root, [
      [side * 1.02, .41, 2.35], [side * 1.66, .12, 1.64],
      [side * 1.56, -.43, 1.7], [side * .97, -.46, 2.26],
    ], .12, trim, 'IntakeLip', 'z')
    plate(root, [
      [side * 1.08, .29, 2.365], [side * 1.53, .075, 1.81],
      [side * 1.47, -.32, 1.84], [side * 1.06, -.35, 2.30],
    ], .02, black, 'IntakeThroat', 'z')
    plate(root, [
      [side * 1.61, .12, 1.61], [side * 1.57, -.4, 1.65],
      [side * 1.39, -.42, -1.92], [side * 1.37, .25, -.9],
    ], .06, skin, 'IntakeFairing', 'x')

    // Flush bay doors underneath and subtle RAM edge strips.
    plate(root, [
      [side * .34, -.653, 1.5], [side * .87, -.61, 1.16],
      [side * .91, -.615, -1.9], [side * .4, -.64, -2.2],
    ], .014, trim, 'WeaponsBay')
    line(root, [[side * .38, .7, .8], [side * .46, .735, -1.8], [side * .31, .65, -3.55]], .014, trim)
  }

  // Low, flattened F-35 canopy: the old tall half-sphere read as a bubble
  // floating above the chine in side profile.
  const canopy = new Mesh(new SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass)
  canopy.name = 'GoldCanopy'
  canopy.scale.set(.74, .48, 1.68)
  canopy.position.set(0, .56, 3.08)
  root.add(canopy)
  const rim: Point[] = []
  for (let i = 0; i <= 40; i++) {
    const a = i / 40 * Math.PI * 2
    rim.push([Math.cos(a) * .755, .56, 3.08 + Math.sin(a) * 1.7])
  }
  line(root, rim, .032, trim)
  plate(root, [[-.55, .72, 1.7], [.55, .72, 1.7], [.38, .8, -.2], [-.38, .8, -.2]], .08, upper, 'DorsalSpine')
  const sensor = new Mesh(new SphereGeometry(.18, 6, 4), glass)
  sensor.scale.set(1, .75, 1.7)
  sensor.position.set(0, -.43, 5.05)
  root.add(sensor)

  buildNozzle(root, metal, black)
  buildGear(root, metal, rubber, skin)
  root.add(buildAfterburner())
  for (const [x, color] of [[-5.22, 0xff3333], [5.22, 0x55ffad]]) {
    const nav = new Mesh(new SphereGeometry(.055, 8, 6), new MeshBasicMaterial({ color, toneMapped: false }))
    nav.position.set(x!, .035, -1.83)
    root.add(nav)
  }
  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.castShadow = !(obj.material instanceof MeshBasicMaterial)
      obj.receiveShadow = true
    }
  })
  return root
}

function buildNozzle(root: Group, metal: Material, black: Material): void {
  const outer = new Mesh(new CylinderGeometry(.67, .72, .72, 24, 1, true), metal)
  outer.rotation.x = Math.PI / 2
  outer.position.set(0, 0, -6.64)
  root.add(outer)
  const liner = new Mesh(new CylinderGeometry(.56, .6, .66, 24, 1, true), black)
  liner.rotation.x = Math.PI / 2
  liner.position.set(0, 0, -6.67)
  root.add(liner)
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2
    const petal = new Mesh(new BoxGeometry(.12, .065, .67), metal)
    petal.position.set(Math.sin(a) * .652, Math.cos(a) * .652, -6.76)
    petal.rotation.z = -a
    root.add(petal)
  }
  const glow = new MeshStandardMaterial({
    name: 'nozzleGlow', color: 0x261c22, emissive: 0xff7638, emissiveIntensity: 0,
    roughness: .6, side: DoubleSide,
  })
  const core = new Mesh(new SphereGeometry(.53, 20, 10), glow)
  core.scale.z = .18
  core.position.z = -6.87
  root.add(core)
  const lip = new Mesh(new TorusGeometry(.62, .038, 6, 24), metal)
  lip.position.z = -7.08
  root.add(lip)
}

function buildGear(root: Group, metal: Material, rubber: Material, skin: Material): void {
  const gear = new Group()
  gear.name = 'landingGear'
  for (const side of [-1, 0, 1]) {
    const nose = side === 0
    const pivot = new Group()
    pivot.name = nose ? 'gearNose' : side < 0 ? 'gearLeft' : 'gearRight'
    pivot.position.set(side * .97, -.48, nose ? 3.82 : -1.35)
    const r = nose ? .24 : .32
    const axleY = -1.4 + r - pivot.position.y
    strut(pivot, [0, 0, 0], [0, axleY, -.15], .047, metal)
    strut(pivot, [0, -.08, -.46], [0, axleY + .08, -.15], .028, metal)
    strut(pivot, [0, axleY + .19, -.15], [side * .18, axleY, -.15], .055, metal)
    const wheel = new Mesh(new CylinderGeometry(r, r, nose ? .16 : .23, 20), rubber)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(side * .18, axleY, -.15)
    pivot.add(wheel)
    for (const face of [-1, 1]) {
      const hub = new Mesh(new CylinderGeometry(r * .53, r * .53, .014, 12), metal)
      hub.rotation.z = Math.PI / 2
      hub.position.copy(wheel.position)
      hub.position.x += face * (nose ? .086 : .121)
      pivot.add(hub)
    }
    const door = new Mesh(new BoxGeometry(.065, .4, nose ? .6 : .85), skin)
    door.position.set(nose ? .19 : side * .28, -.2, -.08)
    pivot.add(door)
    gear.add(pivot)
  }
  root.add(gear)
}

function buildAfterburner(): Group {
  const group = new Group()
  group.name = 'afterburner'
  group.position.z = -7.09
  // Cylinder radius tapers towards aft. Geometry axis is rotated onto -Z.
  for (const [name, color, radius, length, opacity] of [
    ['abOuter', 0x596de0, .57, 3.0, .2],
    ['abMid', 0x59aaff, .4, 2.2, .45],
    ['abCore', 0xe5f5ff, .22, 1.4, .75],
  ] as const) {
    const material = new MeshBasicMaterial({
      name, color, opacity, transparent: true, blending: AdditiveBlending,
      depthWrite: false, side: DoubleSide, toneMapped: true,
    })
    // Fade the silhouette and both ends of each shell into the surrounding air.
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec2 plumeUv;\nvarying vec3 plumeNormal;\nvarying vec3 plumeView;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nplumeUv = uv;\nplumeNormal = normalize(normalMatrix * normal);\nplumeView = -mvPosition.xyz;',
      )
      shader.fragmentShader = 'varying vec2 plumeUv;\nvarying vec3 plumeNormal;\nvarying vec3 plumeView;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat edge = abs(dot(normalize(plumeNormal), normalize(plumeView)));\nfloat lengthFade = pow(max(0.0, sin(plumeUv.y * 3.14159265)), 0.7);\ndiffuseColor.a *= pow(edge, 0.8) * lengthFade;',
      )
    }
    material.customProgramCacheKey = () => 'soft-exhaust-v1'
    const plume = new Mesh(new CylinderGeometry(radius, .015, length, 24, 1, true), material)
    plume.rotation.x = Math.PI / 2
    plume.position.z = -length / 2
    group.add(plume)
  }
  const diamondMat = new MeshBasicMaterial({
    name: 'abCore', color: 0xc4e6ff, transparent: true, opacity: .65,
    blending: AdditiveBlending, depthWrite: false, toneMapped: false,
  })
  for (let i = 0; i < 4; i++) {
    const diamond = new Mesh(new SphereGeometry(1, 8, 6), diamondMat)
    diamond.scale.set(.14 - i * .018, .14 - i * .018, .15)
    diamond.position.z = -.4 - i * .48
    group.add(diamond)
  }
  group.visible = false
  return group
}

function geometry(positions: number[], indices: number[]): BufferGeometry {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/** Closed, triangulated panel with thickness along the supplied axis. */
function plate(
  root: Group, points: Point[], thickness: number, material: Material,
  name: string, axis: 'x' | 'y' | 'z' = 'y',
): void {
  const ai = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  const u = ai === 0 ? 2 : 0
  const v = ai === 1 ? 2 : 1
  const faces = ShapeUtils.triangulateShape(points.map(p => new Vector2(p[u], p[v])), [])
  const positions: number[] = []
  for (const side of [-1, 1]) for (const p of points) {
    const q = [...p]
    q[ai]! += side * thickness / 2
    positions.push(...q)
  }
  const n = points.length
  const indices: number[] = []
  // Determine winding from the first triangulated face in 3D.
  const f = faces[0]!
  const a = new Vector3(...points[f[0]!]!)
  const normal = new Vector3(...points[f[1]!]!).sub(a)
    .cross(new Vector3(...points[f[2]!]!).sub(a))
  const forward = normal.getComponent(ai) > 0
  for (const face of faces) {
    const [a, b, c] = face as [number, number, number]
    if (forward) indices.push(a, c, b, a + n, b + n, c + n)
    else indices.push(a, b, c, a + n, c + n, b + n)
  }
  // Surface faces are double-sided only on panel walls to support mirrored
  // outlines; explicit orientation below keeps their lighting consistent.
  const signed = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % n]!
    return sum + p[u] * q[v] - q[u] * p[v]
  }, 0)
  const ccw = signed * (ai === 1 ? -1 : ai === 0 ? -1 : 1) > 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    if (ccw) indices.push(i, j, i + n, j, j + n, i + n)
    else indices.push(i, i + n, j, j, i + n, j + n)
  }
  const mesh = new Mesh(geometry(positions, indices).toNonIndexed(), material)
  mesh.geometry.computeVertexNormals()
  mesh.name = name
  root.add(mesh)
}

function strut(root: Group, a: Point, b: Point, radius: number, material: Material): void {
  const from = new Vector3(...a)
  const to = new Vector3(...b)
  const delta = to.clone().sub(from)
  const mesh = new Mesh(new CylinderGeometry(radius, radius, delta.length(), 8), material)
  mesh.position.copy(from).add(to).multiplyScalar(.5)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())
  root.add(mesh)
}

function line(root: Group, points: Point[], radius: number, material: Material): void {
  for (let i = 1; i < points.length; i++) strut(root, points[i - 1]!, points[i]!, radius, material)
}
