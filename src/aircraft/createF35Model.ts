import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CylinderGeometry,
  DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, SphereGeometry, TorusGeometry,
  MeshPhysicalMaterial, Vector2, Vector3, type Material,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type Point = [number, number, number]

/** Original, code-built stealth fighter. Metres; +Z forward, +Y up. */
export function createF35Model(): Group {
  const root = new Group()
  root.name = 'F35'
  const skin = new MeshStandardMaterial({ color: 0x626d75, roughness: 0.66, metalness: 0.32 })
  const upper = new MeshStandardMaterial({ color: 0x78838b, roughness: 0.61, metalness: 0.32 })
  const trim = new MeshStandardMaterial({ color: 0x414b54, roughness: 0.7, metalness: 0.25 })
  const ductLining = trim.clone()
  ductLining.side = DoubleSide
  const seam = new MeshStandardMaterial({ color: 0x303b43, roughness: 0.8 })
  const black = new MeshStandardMaterial({ color: 0x090e13, roughness: 0.85 })
  const metal = new MeshStandardMaterial({ color: 0xa8b3bc, roughness: 0.27, metalness: 0.85 })
  const wingMark = new MeshStandardMaterial({
    name: 'wingMark',
    color: 0xb4bfc5,
    emissive: 0x35424b,
    emissiveIntensity: 0.25,
    roughness: 0.42,
    metalness: 0.18,
  })
  const panelBreak = new MeshStandardMaterial({
    name: 'panelBreak',
    color: 0x929fa8,
    roughness: 0.48,
    metalness: 0.34,
  })
  const rubber = new MeshStandardMaterial({ color: 0x11151a, roughness: 0.95 })
  const glass = new MeshPhysicalMaterial({
    name: 'canopyGlass',
    color: 0x80714f, emissive: 0x172b3a, emissiveIntensity: 0.08,
    transparent: true, opacity: .78, depthWrite: false,
    metalness: 0.38, roughness: 0.12,
    clearcoat: 0.86,
    clearcoatRoughness: 0.1,
    ior: 1.44,
  })

  for (const material of [skin, upper]) configureAirframeFinish(material)

  // Cross sections create the pointed radome, chine, broad engine body and
  // round exhaust transition as one continuous skin, with no intersecting tubes.
  const sections: [number, number, number, number][] = [
    [7.85, .018, .015, -.025], [7.25, .22, .13, -.12],
    [6.5, .45, .29, -.24], [5.35, .73, .47, -.39],
    [4.3, .89, .58, -.46], [3.25, 1.02, .65, -.54],
    [2.1, 1.28, .70, -.61], [1.05, 1.46, .73, -.66],
    [-.35, 1.5, .76, -.67], [-1.6, 1.4, .76, -.64],
    [-2.7, 1.24, .71, -.60], [-3.8, 1.05, .61, -.55],
    [-4.85, .9, .54, -.5], [-5.7, .77, .49, -.46],
    [-6.65, .65, .48, -.48],
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
  for (let i = 1; i < ring.length - 1; i++) {
    indices.push(0, i + 1, i)
    const last = (sections.length - 1) * ring.length
    indices.push(last, last + i, last + i + 1)
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
      [side * 5.28, -.045, -1.91], [side * 2.35, .02, -2.43],
      [side * 1.0, .12, -2.6],
    ], .12, upper, 'MainWing')
    plate(root, [
      [side * 2.35, .11, -1.62], [side * 4.15, .03, -1.78],
      [side * 4.02, .03, -2.1], [side * 2.28, .1, -1.98],
    ], .02, wingMark, side < 0 ? 'WingMarkLeft' : 'WingMarkRight')
    const flaperon = plate(root, [
      [side * 1.85, .10, -2.39], [side * 4.93, -.0, -1.92],
      [side * 4.84, .0, -2.21], [side * 2.38, .075, -3.0],
    ], .035, skin, 'Flaperon')
    mountSurface(root, flaperon, [side * 1.85, .10, -2.39], side < 0 ? 'flaperonLeft' : 'flaperonRight')
    line(root, [[side * 1.95, .13, 1.28], [side * 5.18, .025, -1.24]], .022, trim)
    line(root, [[side * 2.38, .12, -3.01], [side * 2.01, .14, -2.35], [side * 4.91, .04, -1.95]], .012, seam)

    const stabilator = plate(root, [
      [side * .73, .12, -3.72], [side * 1.56, .08, -3.58],
      [side * 3.27, -.02, -5.35], [side * 3.15, -.02, -6.06],
      [side * 1.13, .06, -5.75], [side * .64, .1, -5.0],
    ], .1, upper, 'Stabilator')
    mountSurface(root, stabilator, [side * .73, .12, -3.72], side < 0 ? 'stabilatorLeft' : 'stabilatorRight')
    // Fixed, outward-canted fins with independently hinged trailing rudders.
    plate(root, [
      [side * .86, .39, -3.05], [side * 1.05, .39, -5.23],
      [side * 1.96, 2.56, -5.52], [side * 1.92, 2.66, -4.78],
    ], .095, skin, 'CantedTail', 'x')
    const rudder = plate(root, [
      [side * 1.05, .4, -5.25], [side * 1.13, .4, -5.94],
      [side * 2.04, 2.55, -6.08], [side * 1.97, 2.56, -5.55],
    ], .065, upper, 'Rudder', 'x')
    mountSurface(root, rudder, [side * 1.05, .4, -5.25], side < 0 ? 'tailLeft' : 'tailRight')
    plate(root, [
      [side * 1.63, 1.96, -4.62], [side * 1.77, 2.27, -4.78],
      [side * 1.79, 2.27, -5.05], [side * 1.66, 1.96, -4.9],
    ], .016, panelBreak, 'TailCode', 'x')

    const mouth: Point[] = [
      [side * 1.06, .38, 2.8], [side * 1.69, .16, 2.12],
      [side * 1.59, -.43, 2.08], [side * 1.05, -.46, 2.64],
    ]
    const throat = mouth.map(([x, y, z]): Point => [x * .91, y * .8, z - 1.4])
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      const vertices = [...mouth[i]!, ...mouth[j]!, ...throat[i]!, ...throat[j]!]
      const duct = new Mesh(geometry(vertices, side > 0 ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2]), ductLining)
      duct.name = 'IntakeDuct'
      root.add(duct)
    }
    line(root, [...mouth, mouth[0]!], .045, skin)
    plate(root, throat, .018, black, 'IntakeThroat', 'z')
    plate(root, [
      [side * 1.68, .16, 2.1], [side * 1.59, -.43, 2.08],
      [side * 1.42, -.47, -1.94], [side * 1.48, .32, -.65],
    ], .075, skin, 'IntakeFairing', 'x')
    // Diverterless inlet shoulder flows directly into the forward chine.
    const shoulder = new Mesh(new SphereGeometry(1, 12, 8), skin)
    shoulder.name = 'InletShoulder'
    shoulder.position.set(side * 1.02, -.015, 2.85)
    shoulder.scale.set(.19, .36, .76)
    root.add(shoulder)

    // Flush bay doors underneath and subtle RAM edge strips.
    plate(root, [
      [side * .34, -.653, 1.5], [side * .87, -.61, 1.16],
      [side * .91, -.615, -1.9], [side * .4, -.64, -2.2],
    ], .014, trim, 'WeaponsBay')
    line(root, [[side * .38, .7, .8], [side * .46, .735, -1.8], [side * .31, .65, -3.55]], .014, trim)
  }

  plate(root, [
    [-.16, .8, 2.4], [.16, .8, 2.4], [.1, .76, -3.15], [-.1, .76, -3.15],
  ], .018, panelBreak, 'SpineStripe')

  // Section-built teardrop canopy with a narrow rear deck and swept windscreen.
  const canopySections = [
    [1.2, .07, .74, .77], [1.65, .44, .7, .99],
    [2.4, .66, .61, 1.075], [3.2, .67, .56, 1.065],
    [3.95, .51, .51, .91], [4.65, .25, .47, .64], [4.95, .025, .45, .465],
  ] as const
  const canopyPos: number[] = [], canopyIndex: number[] = []
  const arches = 20
  for (const [z, width, base, top] of canopySections) {
    for (let i = 0; i <= arches; i++) {
      const angle = i / arches * Math.PI
      canopyPos.push(Math.cos(angle) * width, base + Math.sin(angle) * (top - base), z)
    }
  }
  for (let j = 0; j < canopySections.length - 1; j++) for (let i = 0; i < arches; i++) {
    const a = j * (arches + 1) + i, b = a + arches + 1
    canopyIndex.push(a, a + 1, b, a + 1, b + 1, b)
  }
  const canopy = new Mesh(geometry(canopyPos, canopyIndex), glass)
  canopy.name = 'GoldCanopy'
  root.add(canopy)
  for (const side of [-1, 1]) {
    line(root, canopySections.map(([z, width, base]): Point => [side * width, base, z]), .023, trim)
  }
  plate(root, [[-.51, .715, 1.55], [.51, .715, 1.55], [.38, .79, -.35], [-.38, .79, -.35]], .06, upper, 'DorsalSpine')
  // External-only cockpit detail lives inside the aircraft model; first-person
  // remains the unobstructed view selected by CockpitMode.
  const tub = new Mesh(new BoxGeometry(.83, .12, 1.8), black)
  tub.name = 'CockpitWell'; tub.position.set(0, .73, 2.8); root.add(tub)
  const seat = new Mesh(new BoxGeometry(.37, .2, .2), trim)
  seat.name = 'EjectionSeat'; seat.position.set(0, .87, 2.15); root.add(seat)
  const helmet = new Mesh(new SphereGeometry(.13, 12, 8), upper)
  helmet.name = 'PilotHelmet'; helmet.scale.set(.85, 1, 1.05)
  helmet.position.set(0, .89, 2.6); root.add(helmet)
  const visor = new Mesh(new SphereGeometry(.12, 12, 6, 0, Math.PI), black)
  visor.name = 'PilotVisor'; visor.scale.set(1, .53, 1)
  visor.position.set(0, .91, 2.65); root.add(visor)
  const sensor = new Mesh(new SphereGeometry(.18, 6, 4), glass)
  sensor.name = 'ChinSensor'
  sensor.scale.set(1, .75, 1.7); sensor.position.set(0, -.43, 5.05); root.add(sensor)
  for (const side of [-1, 1]) {
    // Sawtooth access panels and flush upper engine vents.
    line(root, [[side * .48, .73, .7], [side * .66, .76, .48],
      [side * .55, .77, .18], [side * .7, .77, -.02], [side * .61, .74, -1.45]], .01, panelBreak)
    for (let i = 0; i < 5; i++) {
      line(root, [[side * .52, .715 - i * .008, -2.65 - i * .12],
        [side * .83, .65 - i * .008, -2.65 - i * .12]], .018, black)
    }
  }

  buildNozzle(root, metal, black)
  buildGear(root, metal, rubber, skin)
  root.add(buildVaporTrails())
  root.add(buildAfterburner())
  const beacon = new Mesh(
    new SphereGeometry(.07, 8, 6),
    new MeshBasicMaterial({
      name: 'antiCollisionBeaconMaterial',
      color: 0xffd6a1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  beacon.name = 'antiCollisionBeacon'
  beacon.position.set(0, .88, -1.55)
  root.add(beacon)
  for (const [x, color, name] of [
    [-5.22, 0xff3333, 'navLightLeft'],
    [5.22, 0x55ffad, 'navLightRight'],
  ] as const) {
    const nav = new Mesh(
      new SphereGeometry(.055, 8, 6),
      new MeshBasicMaterial({
        name: `${name}Material`,
        color,
        transparent: true,
        opacity: .82,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    nav.name = name
    nav.position.set(x, .035, -1.83)
    root.add(nav)
  }
  const landingLight = new Mesh(
    new SphereGeometry(.09, 8, 6),
    new MeshBasicMaterial({
      name: 'landingLightMaterial',
      color: 0xfff2cf,
      transparent: true,
      opacity: .95,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  landingLight.name = 'landingLightNose'
  landingLight.position.set(0, -.76, 3.58)
  root.add(landingLight)
  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.castShadow = !(obj.material instanceof MeshBasicMaterial)
      obj.receiveShadow = true
    }
  })
  batchStaticDetails(root)
  markPresentationNodes(root)
  freezeStaticMatrices(root)
  return root
}

/** Keep only nodes touched by the flight presentation loop on live local matrices. */
function markPresentationNodes(root: Group): void {
  const dynamicRoots = [
    'landingGear',
    'flaperonLeft',
    'flaperonRight',
    'stabilatorLeft',
    'stabilatorRight',
    'tailLeft',
    'tailRight',
    'afterburner',
    'vaporTrails',
  ]
  for (const name of dynamicRoots) {
    root.getObjectByName(name)?.traverse((object) => {
      object.userData.presentationDynamic = true
    })
  }
  for (let i = 0; i < 18; i++) {
    root.getObjectByName(`nozzlePetal${i}`)?.traverse((object) => {
      object.userData.presentationDynamic = true
    })
  }
}

/** Freeze authored local transforms so the aircraft parent can move cheaply. */
function freezeStaticMatrices(root: Group): void {
  root.traverse((object) => {
    if (object.userData.presentationDynamic) return
    object.updateMatrix()
    object.matrixAutoUpdate = false
  })
}

/** Two shared-material wingtip vapor ribbons for fast, hard-bank turns. */
function buildVaporTrails(): Group {
  const group = new Group()
  group.name = 'vaporTrails'
  const material = new MeshBasicMaterial({
    name: 'vaporTrail',
    color: 0xb8d8e6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
  for (const side of [-1, 1] as const) {
    const trail = new Mesh(
      new CylinderGeometry(.14, .018, 5.2, 8, 1, true),
      material,
    )
    trail.name = side < 0 ? 'vaporTrailLeft' : 'vaporTrailRight'
    trail.rotation.x = Math.PI / 2
    trail.position.set(side * 4.78, .06, -4.68)
    trail.visible = false
    group.add(trail)
  }
  return group
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
    petal.name = `nozzlePetal${i}`
    petal.userData.nozzleAngle = a
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
    wheel.name = nose ? 'wheelNose' : side < 0 ? 'wheelLeft' : 'wheelRight'
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
    door.name = nose ? 'gearDoorNose' : side < 0 ? 'gearDoorLeft' : 'gearDoorRight'
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
      depthWrite: false, side: DoubleSide, toneMapped: name === 'abOuter',
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
    plume.name = name
    plume.rotation.x = Math.PI / 2
    plume.position.z = -length / 2
    group.add(plume)
  }
  const diamondMat = new MeshBasicMaterial({
    name: 'abCore', color: 0xf4fbff, transparent: true, opacity: .92,
    blending: AdditiveBlending, depthWrite: false, toneMapped: false,
  })
  for (let i = 0; i < 4; i++) {
    const diamond = new Mesh(new SphereGeometry(1, 8, 6), diamondMat)
    diamond.name = `abDiamond${i}`
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
): Mesh {
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
  return mesh
}

/** Move a panel under a local hinge so flight controls can animate it. */
function mountSurface(root: Group, mesh: Mesh, pivot: Point, name: string): Group {
  root.remove(mesh)
  const group = new Group()
  group.name = name
  group.position.set(...pivot)
  mesh.position.set(-pivot[0], -pivot[1], -pivot[2])
  group.add(mesh)
  root.add(group)
  return group
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

/** Restrained coating variation and access seams without texture downloads. */
function configureAirframeFinish(material: MeshStandardMaterial): void {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 airframePoint;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nairframePoint = position;')
    shader.fragmentShader = 'varying vec3 airframePoint;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float coating = sin(airframePoint.z * 2.8 + airframePoint.x * 1.2) * sin(airframePoint.x * 6.0);
      diffuseColor.rgb *= .97 + coating * .03;
      float panel = abs(fract((airframePoint.z + abs(airframePoint.x) * .4) * .72) - .5);
      float lineWidth = max(fwidth(panel), .0015);
      float seam = 1.0 - smoothstep(.003, .003 + lineWidth, panel);
      diffuseColor.rgb *= 1.0 - seam * .11;`)
  }
  material.customProgramCacheKey = () => 'f35-coating-v2'
}

/** Batch anonymous static trim only; named controls retain their articulation. */
function batchStaticDetails(root: Group): void {
  const batches = new Map<Material, Mesh[]>()
  for (const child of root.children) {
    if (!(child instanceof Mesh) || child.name || Array.isArray(child.material)) continue
    const items = batches.get(child.material) ?? []
    items.push(child); batches.set(child.material, items)
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue
    const parts = meshes.map(mesh => {
      mesh.updateMatrix()
      const copy = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      copy.deleteAttribute('uv')
      return copy.applyMatrix4(mesh.matrix)
    })
    const merged = mergeGeometries(parts)
    for (const part of parts) part.dispose()
    if (!merged) continue
    const detail = new Mesh(merged, material)
    detail.name = 'AirframeDetailBatch'
    detail.castShadow = true; detail.receiveShadow = true
    root.add(detail)
    for (const mesh of meshes) { root.remove(mesh); mesh.geometry.dispose() }
  }
}
