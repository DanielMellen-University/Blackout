import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  Vector2,
  type Object3D,
} from 'three'

/**
 * Cleaner procedural F-35A silhouette.
 * Units ≈ meters. Nose = +Z. Length ~15.6 m, span ~10.7 m.
 *
 * Drop `public/models/f35.glb` to replace with a real asset.
 */
export function createPlaceholderF35(): Group {
  const root = new Group()
  root.name = 'F35'

  const ram = makeRamMaterial(0x5c646c)
  const ramDark = makeRamMaterial(0x3a424a)
  const ramDeep = makeRamMaterial(0x252b32)
  const metal = new MeshStandardMaterial({
    color: 0x1c1e22,
    metalness: 0.9,
    roughness: 0.28,
  })
  const nozzleMat = new MeshStandardMaterial({
    color: 0x141210,
    metalness: 0.92,
    roughness: 0.3,
    emissive: 0x221100,
    emissiveIntensity: 0.2,
  })
  const canopyMat = new MeshStandardMaterial({
    color: 0x0c1824,
    metalness: 1,
    roughness: 0.04,
    transparent: true,
    opacity: 0.78,
    envMapIntensity: 1.4,
  })
  const gearMat = new MeshStandardMaterial({
    color: 0x2a2e34,
    metalness: 0.75,
    roughness: 0.35,
  })
  const tireMat = new MeshStandardMaterial({
    color: 0x111114,
    metalness: 0.1,
    roughness: 0.9,
  })

  // --- Main body (nose integrated — no floating cone) ---
  root.add(buildFuselage(ram))

  // Slightly faceted upper spine (stealth blend)
  const spine = new Mesh(new BoxGeometry(0.55, 0.22, 7.5), ramDark)
  spine.position.set(0, 0.55, 0.4)
  root.add(spine)

  // Chin EOTS fairing (small, blended)
  const eots = new Mesh(new SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), ramDark)
  eots.scale.set(0.85, 0.55, 1.1)
  eots.position.set(0, -0.38, 5.15)
  root.add(eots)

  // Canopy bubble + frame
  root.add(buildCanopy(canopyMat, ramDeep))

  // DSI intakes (blended side scoops, not boxes)
  root.add(buildIntake(1, ram, ramDeep, metal))
  root.add(buildIntake(-1, ram, ramDeep, metal))

  // Wings + control surfaces
  root.add(buildWing(1, ram, ramDark))
  root.add(buildWing(-1, ram, ramDark))

  // Horizontal tails
  root.add(buildHStab(1, ram))
  root.add(buildHStab(-1, ram))

  // Twin canted vertical tails (signature F-35 look)
  root.add(buildVStab(1, ram, ramDark))
  root.add(buildVStab(-1, ram, ramDark))

  // Engine / nozzle
  root.add(buildNozzle(nozzleMat, metal, ramDeep))

  // Weapons bay outline (subtle belly panel)
  const bay = new Mesh(new BoxGeometry(1.15, 0.08, 4.8), ramDeep)
  bay.position.set(0, -0.58, 0.3)
  root.add(bay)

  // Landing gear
  addGear(root, gearMat, tireMat)

  // Nav lights (wingtips)
  addNavLight(root, -5.15, 0.02, -0.35, 0xff2020)
  addNavLight(root, 5.15, 0.02, -0.35, 0x20ff40)
  addNavLight(root, 0, 1.55, -5.5, 0xfff5e0)

  root.traverse((obj: Object3D) => {
    const mesh = obj as Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })

  return root
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function makeRamMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    map: panelTexture(),
    metalness: 0.48,
    roughness: 0.46,
    flatShading: false,
  })
}

function panelTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!

  // Base RAM gray
  ctx.fillStyle = '#6a727c'
  ctx.fillRect(0, 0, 512, 512)

  // Soft noise
  for (let i = 0; i < 4000; i++) {
    const v = 90 + Math.random() * 50
    ctx.fillStyle = `rgba(${v},${v + 3},${v + 6},${0.04 + Math.random() * 0.06})`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }

  // Panel seams
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1.2
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 512)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(512, i)
    ctx.stroke()
  }

  // Sawtooth stealth seams
  ctx.strokeStyle = 'rgba(0,0,0,0.14)'
  ctx.lineWidth = 1
  for (let i = -512; i < 512; i += 56) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 180, 512)
    ctx.stroke()
  }

  // Edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  for (let i = 32; i < 512; i += 64) {
    ctx.beginPath()
    ctx.moveTo(i + 1, 0)
    ctx.lineTo(i + 1, 512)
    ctx.stroke()
  }

  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(3, 3)
  tex.anisotropy = 4
  return tex
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function buildFuselage(mat: MeshStandardMaterial): Mesh {
  // Profile: x = radius, y = station along length (lathe around Y, then rot to +Z)
  // Pointed nose at high y → becomes +Z after rotation
  const pts: Vector2[] = [
    new Vector2(0.01, 7.2), // sharp nose tip
    new Vector2(0.22, 6.7),
    new Vector2(0.42, 5.9),
    new Vector2(0.55, 5.0),
    new Vector2(0.68, 3.8),
    new Vector2(0.78, 2.2),
    new Vector2(0.84, 0.6),
    new Vector2(0.86, -0.8),
    new Vector2(0.82, -2.4),
    new Vector2(0.72, -4.0),
    new Vector2(0.58, -5.4),
    new Vector2(0.48, -6.2),
    new Vector2(0.42, -6.7), // nozzle station
  ]
  const geo = new LatheGeometry(pts, 32)
  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = Math.PI / 2
  // Flatten slightly for stealth oval cross-section
  mesh.scale.set(1.08, 0.78, 1)
  return mesh
}

function buildCanopy(glass: MeshStandardMaterial, frameMat: MeshStandardMaterial): Group {
  const g = new Group()

  // Bubble
  const bubble = new Mesh(new SphereGeometry(0.72, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), glass)
  bubble.scale.set(0.78, 0.62, 1.45)
  bubble.position.set(0, 0.52, 2.85)
  g.add(bubble)

  // Sill / frame ring
  const sill = new Mesh(new BoxGeometry(1.05, 0.07, 2.5), frameMat)
  sill.position.set(0, 0.32, 2.85)
  g.add(sill)

  // Rear canopy fairing blend
  const fairing = new Mesh(new BoxGeometry(0.7, 0.18, 0.9), frameMat)
  fairing.position.set(0, 0.48, 1.55)
  fairing.rotation.x = 0.25
  g.add(fairing)

  return g
}

// ---------------------------------------------------------------------------
// Wings / tails
// ---------------------------------------------------------------------------

function buildWing(side: 1 | -1, skin: MeshStandardMaterial, edge: MeshStandardMaterial): Group {
  const g = new Group()

  // F-35 clipped-diamond planform (top view: +X outboard, +Y toward nose)
  const shape = new Shape()
  shape.moveTo(0.55, 2.0) // root LE
  shape.lineTo(5.2, 0.15) // tip LE
  shape.lineTo(5.05, -0.55) // tip mid
  shape.lineTo(4.85, -1.35) // tip TE (clipped)
  shape.lineTo(0.65, -2.55) // root TE
  shape.lineTo(0.55, 2.0)

  const geo = new ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.03,
    bevelSegments: 2,
  })
  const wing = new Mesh(geo, skin)
  wing.rotation.x = -Math.PI / 2
  wing.position.set(0, -0.02, -0.15)
  wing.rotation.z = side * 0.03 // tiny dihedral
  if (side < 0) wing.scale.x = -1
  g.add(wing)

  // LERX / leading-edge root extension blend
  const lerxShape = new Shape()
  lerxShape.moveTo(0, 0)
  lerxShape.lineTo(1.8, 1.6)
  lerxShape.lineTo(1.5, 2.4)
  lerxShape.lineTo(0.15, 1.1)
  lerxShape.closePath()
  const lerxGeo = new ExtrudeGeometry(lerxShape, { depth: 0.08, bevelEnabled: false })
  const lerx = new Mesh(lerxGeo, edge)
  lerx.rotation.x = -Math.PI / 2
  lerx.position.set(side * 0.5, 0.02, 1.4)
  if (side < 0) lerx.scale.x = -1
  g.add(lerx)

  // Flaperon strip
  const flap = new Mesh(new BoxGeometry(2.4, 0.05, 0.48), edge)
  flap.position.set(side * 3.0, -0.1, -2.05)
  g.add(flap)

  return g
}

function buildHStab(side: 1 | -1, skin: MeshStandardMaterial): Mesh {
  const shape = new Shape()
  shape.moveTo(0.15, 0.85)
  shape.lineTo(2.15, 0.1)
  shape.lineTo(2.05, -0.5)
  shape.lineTo(0.2, -0.75)
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.02,
    bevelSegments: 1,
  })
  const m = new Mesh(geo, skin)
  m.rotation.x = -Math.PI / 2
  m.position.set(side * 0.4, 0.18, -4.85)
  if (side < 0) m.scale.x = -1
  return m
}

function buildVStab(side: 1 | -1, skin: MeshStandardMaterial, edge: MeshStandardMaterial): Group {
  const g = new Group()

  // Canted twin tails — trapezoid in local plane
  const shape = new Shape()
  shape.moveTo(0.0, 0.0) // root front
  shape.lineTo(0.25, 2.05) // tip front
  shape.lineTo(-1.15, 1.75) // tip rear
  shape.lineTo(-1.0, 0.0) // root rear
  shape.closePath()

  const geo = new ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.015,
    bevelSegments: 1,
  })
  const fin = new Mesh(geo, skin)
  // Stand up, chord along -Z
  fin.rotation.y = Math.PI / 2
  fin.position.set(side * 0.88, 0.42, -4.55)
  // Outward cant ~24°
  fin.rotation.z = side * -0.42
  g.add(fin)

  // Rudder tab
  const rudder = new Mesh(new BoxGeometry(0.07, 1.05, 0.38), edge)
  rudder.position.set(side * 1.28, 1.15, -5.25)
  rudder.rotation.z = side * -0.42
  g.add(rudder)

  return g
}

// ---------------------------------------------------------------------------
// Intakes / nozzle
// ---------------------------------------------------------------------------

function buildIntake(
  side: 1 | -1,
  skin: MeshStandardMaterial,
  dark: MeshStandardMaterial,
  metal: MeshStandardMaterial,
): Group {
  const g = new Group()

  // Main DSI body — tapered box (less brick-like)
  const body = new Mesh(new BoxGeometry(0.72, 0.58, 2.3), dark)
  body.position.set(side * 0.92, -0.12, 1.15)
  body.rotation.y = side * 0.08
  body.scale.set(1, 1, 1)
  g.add(body)

  // Outer blend cheek
  const cheek = new Mesh(new BoxGeometry(0.35, 0.45, 1.8), skin)
  cheek.position.set(side * 1.25, -0.05, 1.0)
  cheek.rotation.y = side * 0.18
  g.add(cheek)

  // Upper diverter bump
  const bump = new Mesh(new SphereGeometry(0.38, 12, 8, 0, Math.PI), skin)
  bump.scale.set(0.55, 0.38, 1.15)
  bump.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
  bump.position.set(side * 0.78, 0.12, 1.35)
  g.add(bump)

  // Lip
  const lip = new Mesh(new BoxGeometry(0.78, 0.1, 0.28), metal)
  lip.position.set(side * 0.92, 0.12, 2.25)
  g.add(lip)

  // Dark inlet void
  const voidMesh = new Mesh(new BoxGeometry(0.5, 0.38, 0.15), metal)
  voidMesh.position.set(side * 0.92, -0.08, 2.35)
  g.add(voidMesh)

  return g
}

function buildNozzle(
  nozzleMat: MeshStandardMaterial,
  metal: MeshStandardMaterial,
  dark: MeshStandardMaterial,
): Group {
  const g = new Group()

  const housing = new Mesh(new CylinderGeometry(0.5, 0.46, 1.15, 20), nozzleMat)
  housing.rotation.x = Math.PI / 2
  housing.position.set(0, 0.02, -6.55)
  g.add(housing)

  // Serrated look — ring of small wedges (simple dark ring)
  const petal = new Mesh(new CylinderGeometry(0.52, 0.44, 0.22, 16), dark)
  petal.rotation.x = Math.PI / 2
  petal.position.set(0, 0.02, -7.05)
  g.add(petal)

  const inner = new Mesh(new CylinderGeometry(0.34, 0.38, 0.4, 16), metal)
  inner.rotation.x = Math.PI / 2
  inner.position.set(0, 0.02, -7.15)
  g.add(inner)

  const glow = new Mesh(
    new CylinderGeometry(0.32, 0.32, 0.06, 16),
    new MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff3300,
      emissiveIntensity: 1.6,
      metalness: 0.15,
      roughness: 0.55,
    }),
  )
  glow.rotation.x = Math.PI / 2
  glow.position.set(0, 0.02, -7.28)
  g.add(glow)

  return g
}

// ---------------------------------------------------------------------------
// Gear / lights
// ---------------------------------------------------------------------------

function addGear(root: Group, strutMat: MeshStandardMaterial, tireMat: MeshStandardMaterial): void {
  const makeLeg = (x: number, z: number, tall: number, dual = false) => {
    const door = new Mesh(new BoxGeometry(0.35, 0.04, 0.7), strutMat)
    door.position.set(x, -0.52, z)
    root.add(door)

    const leg = new Mesh(new CylinderGeometry(0.045, 0.055, tall, 8), strutMat)
    leg.position.set(x, -0.52 - tall / 2, z)
    root.add(leg)

    const wheel = (ox: number) => {
      const w = new Mesh(new CylinderGeometry(0.18, 0.18, 0.12, 14), tireMat)
      w.rotation.z = Math.PI / 2
      w.position.set(x + ox, -0.52 - tall, z)
      root.add(w)
    }
    if (dual) {
      wheel(-0.12)
      wheel(0.12)
    } else {
      wheel(0)
    }
  }

  // Nose gear
  makeLeg(0, 3.35, 0.95, false)
  // Mains
  makeLeg(-1.05, -0.65, 0.88, true)
  makeLeg(1.05, -0.65, 0.88, true)
}

function addNavLight(root: Group, x: number, y: number, z: number, color: number): void {
  const mat = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.1,
    metalness: 0.2,
    roughness: 0.4,
  })
  const light = new Mesh(new SphereGeometry(0.055, 8, 8), mat)
  light.position.set(x, y, z)
  root.add(light)
}
