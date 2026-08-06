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
 * Procedural F-35A silhouette.
 * Body: light aircraft grey. Glass / tires / voids / details: black.
 * Nose = +Z. Length ~15.6 m, span ~10.7 m.
 */
export function createPlaceholderF35(): Group {
  const root = new Group()
  root.name = 'F35'

  // --- Palette ---
  const grey = makeGrey(0x9aa3ad) // main airframe
  const greyMid = makeGrey(0x7e8792) // secondary panels
  const greyDark = makeGrey(0x5c6570) // edges / LERX (still grey, not black)
  const black = solid(0x0a0c0e, 0.35, 0.55) // details
  const glass = new MeshStandardMaterial({
    color: 0x05080c,
    metalness: 0.95,
    roughness: 0.06,
    transparent: true,
    opacity: 0.82,
  })
  const tire = solid(0x0c0c0e, 0.05, 0.95)
  const nozzleOuter = solid(0x1a1c20, 0.85, 0.35)
  const glowMat = new MeshStandardMaterial({
    color: 0xff5500,
    emissive: 0xff3300,
    emissiveIntensity: 1.5,
    metalness: 0.1,
    roughness: 0.55,
  })

  root.add(buildFuselage(grey))

  // Upper spine (mid grey)
  const spine = new Mesh(new BoxGeometry(0.5, 0.2, 7.2), greyMid)
  spine.position.set(0, 0.52, 0.35)
  root.add(spine)

  // Chin EOTS (dark detail)
  const eots = new Mesh(new SphereGeometry(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), black)
  eots.scale.set(0.85, 0.5, 1.05)
  eots.position.set(0, -0.36, 5.1)
  root.add(eots)

  root.add(buildCanopy(glass, black))
  root.add(buildIntake(1, grey, greyMid, black))
  root.add(buildIntake(-1, grey, greyMid, black))
  root.add(buildWing(1, grey, greyDark))
  root.add(buildWing(-1, grey, greyDark))
  root.add(buildHStab(1, grey))
  root.add(buildHStab(-1, grey))
  root.add(buildVStab(1, grey, black))
  root.add(buildVStab(-1, grey, black))
  root.add(buildNozzle(nozzleOuter, black, glowMat))

  // Belly bay panel
  const bay = new Mesh(new BoxGeometry(1.1, 0.07, 4.6), greyMid)
  bay.position.set(0, -0.56, 0.25)
  root.add(bay)

  addGear(root, black, tire)
  addNavLight(root, -5.15, 0.02, -0.35, 0xff2020)
  addNavLight(root, 5.15, 0.02, -0.35, 0x20ff40)
  addNavLight(root, 0, 1.55, -5.45, 0xfff5e0)

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

function solid(color: number, metalness: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness })
}

function makeGrey(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    map: panelTexture(),
    metalness: 0.42,
    roughness: 0.5,
  })
}

function panelTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#a0a8b0'
  ctx.fillRect(0, 0, 512, 512)

  for (let i = 0; i < 3500; i++) {
    const v = 140 + Math.random() * 40
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},0.06)`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }

  ctx.strokeStyle = 'rgba(40,45,50,0.2)'
  ctx.lineWidth = 1
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

  ctx.strokeStyle = 'rgba(30,35,40,0.12)'
  for (let i = -512; i < 512; i += 56) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 180, 512)
    ctx.stroke()
  }

  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(3, 3)
  return tex
}

// ---------------------------------------------------------------------------

function buildFuselage(mat: MeshStandardMaterial): Mesh {
  const pts: Vector2[] = [
    new Vector2(0.01, 7.2),
    new Vector2(0.2, 6.75),
    new Vector2(0.4, 5.95),
    new Vector2(0.54, 5.05),
    new Vector2(0.66, 3.85),
    new Vector2(0.76, 2.2),
    new Vector2(0.82, 0.6),
    new Vector2(0.84, -0.8),
    new Vector2(0.8, -2.4),
    new Vector2(0.7, -4.0),
    new Vector2(0.56, -5.4),
    new Vector2(0.46, -6.2),
    new Vector2(0.4, -6.7),
  ]
  const geo = new LatheGeometry(pts, 32)
  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = Math.PI / 2
  mesh.scale.set(1.08, 0.78, 1)
  return mesh
}

function buildCanopy(glass: MeshStandardMaterial, frame: MeshStandardMaterial): Group {
  const g = new Group()

  const bubble = new Mesh(new SphereGeometry(0.72, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), glass)
  bubble.scale.set(0.78, 0.62, 1.45)
  bubble.position.set(0, 0.52, 2.85)
  g.add(bubble)

  const sill = new Mesh(new BoxGeometry(1.05, 0.07, 2.5), frame)
  sill.position.set(0, 0.32, 2.85)
  g.add(sill)

  const fairing = new Mesh(new BoxGeometry(0.68, 0.16, 0.85), frame)
  fairing.position.set(0, 0.46, 1.55)
  fairing.rotation.x = 0.22
  g.add(fairing)

  return g
}

function buildWing(side: 1 | -1, skin: MeshStandardMaterial, edge: MeshStandardMaterial): Group {
  const g = new Group()

  const shape = new Shape()
  shape.moveTo(0.55, 2.0)
  shape.lineTo(5.2, 0.15)
  shape.lineTo(5.05, -0.55)
  shape.lineTo(4.85, -1.35)
  shape.lineTo(0.65, -2.55)
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
  wing.rotation.z = side * 0.03
  if (side < 0) wing.scale.x = -1
  g.add(wing)

  const lerxShape = new Shape()
  lerxShape.moveTo(0, 0)
  lerxShape.lineTo(1.8, 1.6)
  lerxShape.lineTo(1.5, 2.4)
  lerxShape.lineTo(0.15, 1.1)
  lerxShape.closePath()
  const lerx = new Mesh(new ExtrudeGeometry(lerxShape, { depth: 0.08, bevelEnabled: false }), edge)
  lerx.rotation.x = -Math.PI / 2
  lerx.position.set(side * 0.5, 0.02, 1.4)
  if (side < 0) lerx.scale.x = -1
  g.add(lerx)

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
  const m = new Mesh(
    new ExtrudeGeometry(shape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.02,
      bevelSegments: 1,
    }),
    skin,
  )
  m.rotation.x = -Math.PI / 2
  m.position.set(side * 0.4, 0.18, -4.85)
  if (side < 0) m.scale.x = -1
  return m
}

/**
 * Vertical stabilizers — upright plate (Y=up, X=chord along body after rot),
 * canted outward. Rudder is parented to the fin so it never floats free.
 */
function buildVStab(side: 1 | -1, skin: MeshStandardMaterial, detail: MeshStandardMaterial): Group {
  const g = new Group()

  // Shape in XY before placement: +Y up, +X toward nose, TE negative X
  const shape = new Shape()
  shape.moveTo(0.35, 0.0) // root LE
  shape.lineTo(0.12, 2.05) // tip LE (swept)
  shape.lineTo(-0.78, 1.82) // tip TE
  shape.lineTo(-0.72, 0.0) // root TE
  shape.closePath()

  const fin = new Mesh(
    new ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 1,
    }),
    skin,
  )
  fin.geometry.translate(0, 0, -0.05) // center thickness on origin

  // Black rudder strip on trailing edge (child of fin = always attached)
  const rudder = new Mesh(new BoxGeometry(0.26, 0.95, 0.07), detail)
  rudder.position.set(-0.8, 0.95, 0)
  fin.add(rudder)

  // Map shape +X → aircraft +Z (forward), thickness → lateral
  fin.rotation.y = -Math.PI / 2

  const pivot = new Group()
  pivot.add(fin)
  // Root sits on rear fuselage deck
  pivot.position.set(side * 0.72, 0.45, -4.4)
  // Outward cant ~23°
  pivot.rotation.z = side * -0.4

  g.add(pivot)
  return g
}

function buildIntake(
  side: 1 | -1,
  skin: MeshStandardMaterial,
  mid: MeshStandardMaterial,
  black: MeshStandardMaterial,
): Group {
  const g = new Group()

  const body = new Mesh(new BoxGeometry(0.72, 0.58, 2.3), mid)
  body.position.set(side * 0.92, -0.12, 1.15)
  body.rotation.y = side * 0.08
  g.add(body)

  const cheek = new Mesh(new BoxGeometry(0.35, 0.45, 1.8), skin)
  cheek.position.set(side * 1.25, -0.05, 1.0)
  cheek.rotation.y = side * 0.18
  g.add(cheek)

  const bump = new Mesh(new SphereGeometry(0.38, 12, 8, 0, Math.PI), skin)
  bump.scale.set(0.55, 0.38, 1.15)
  bump.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
  bump.position.set(side * 0.78, 0.12, 1.35)
  g.add(bump)

  const lip = new Mesh(new BoxGeometry(0.78, 0.1, 0.28), black)
  lip.position.set(side * 0.92, 0.12, 2.25)
  g.add(lip)

  const inlet = new Mesh(new BoxGeometry(0.5, 0.38, 0.15), black)
  inlet.position.set(side * 0.92, -0.08, 2.35)
  g.add(inlet)

  return g
}

function buildNozzle(
  outer: MeshStandardMaterial,
  black: MeshStandardMaterial,
  glow: MeshStandardMaterial,
): Group {
  const g = new Group()

  const housing = new Mesh(new CylinderGeometry(0.5, 0.46, 1.15, 20), outer)
  housing.rotation.x = Math.PI / 2
  housing.position.set(0, 0.02, -6.55)
  g.add(housing)

  const petal = new Mesh(new CylinderGeometry(0.52, 0.44, 0.22, 16), black)
  petal.rotation.x = Math.PI / 2
  petal.position.set(0, 0.02, -7.05)
  g.add(petal)

  const inner = new Mesh(new CylinderGeometry(0.34, 0.38, 0.4, 16), black)
  inner.rotation.x = Math.PI / 2
  inner.position.set(0, 0.02, -7.15)
  g.add(inner)

  const core = new Mesh(new CylinderGeometry(0.32, 0.32, 0.06, 16), glow)
  core.rotation.x = Math.PI / 2
  core.position.set(0, 0.02, -7.28)
  g.add(core)

  return g
}

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

  makeLeg(0, 3.35, 0.95, false)
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
