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
 * Procedural F-35A — top-down planform matched to the real jet.
 * Grey airframe, black glass / tires / voids. Nose = +Z.
 */
export function createPlaceholderF35(): Group {
  const root = new Group()
  root.name = 'F35'

  const grey = makeGrey(0x9aa3ad)
  const greyMid = makeGrey(0x7e8792)
  const black = solid(0x0a0c0e, 0.35, 0.55)
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
  root.add(buildCanopy(glass, black))
  root.add(buildWingPair(grey)) // single continuous wing mesh (L+R)
  root.add(buildHStabPair(grey))
  root.add(buildVStab(1, grey, black))
  root.add(buildVStab(-1, grey, black))
  root.add(buildIntake(1, grey, greyMid, black))
  root.add(buildIntake(-1, grey, greyMid, black))
  root.add(buildNozzle(nozzleOuter, black, glowMat))

  // Chin EOTS
  const eots = new Mesh(new SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), black)
  eots.scale.set(0.9, 0.48, 1.0)
  eots.position.set(0, -0.34, 5.0)
  root.add(eots)

  // Belly
  const bay = new Mesh(new BoxGeometry(1.05, 0.06, 4.4), greyMid)
  bay.position.set(0, -0.54, 0.2)
  root.add(bay)

  addGear(root, black, tire)
  addNavLight(root, -5.35, 0.02, -0.5, 0xff2020)
  addNavLight(root, 5.35, 0.02, -0.5, 0x20ff40)
  addNavLight(root, 0, 1.5, -5.5, 0xfff5e0)

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

function solid(color: number, metalness: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness })
}

function makeGrey(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    map: panelTexture(),
    metalness: 0.4,
    roughness: 0.52,
  })
}

function panelTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#a0a8b0'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 3000; i++) {
    const v = 145 + Math.random() * 35
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},0.05)`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }
  ctx.strokeStyle = 'rgba(40,45,50,0.18)'
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
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(3, 3)
  return tex
}

// ---------------------------------------------------------------------------
// Fuselage / canopy
// ---------------------------------------------------------------------------

function buildFuselage(mat: MeshStandardMaterial): Mesh {
  // Lathe along local +Y; after rotX(90°) that becomes world +Z (nose).
  // Rear taper meets the nozzle — keep length unscaled so parts line up.
  const pts: Vector2[] = [
    new Vector2(0.01, 7.15),
    new Vector2(0.18, 6.7),
    new Vector2(0.38, 5.9),
    new Vector2(0.52, 5.0),
    new Vector2(0.64, 3.8),
    new Vector2(0.74, 2.2),
    new Vector2(0.8, 0.5),
    new Vector2(0.82, -1.0),
    new Vector2(0.76, -2.6),
    new Vector2(0.66, -4.1),
    new Vector2(0.55, -5.3),
    new Vector2(0.48, -6.0),
    new Vector2(0.45, -6.45), // mates with nozzle
  ]
  const mesh = new Mesh(new LatheGeometry(pts, 36), mat)
  mesh.rotation.x = Math.PI / 2
  // Local X = width, Y = length (→ world Z), Z = height (→ world -Y)
  // Flatten height only — do NOT scale length or the tail/nozzle float apart
  mesh.scale.set(1.1, 1, 0.78)
  return mesh
}

function buildCanopy(glass: MeshStandardMaterial, frame: MeshStandardMaterial): Group {
  const g = new Group()
  const bubble = new Mesh(new SphereGeometry(0.7, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), glass)
  bubble.scale.set(0.76, 0.58, 1.4)
  bubble.position.set(0, 0.5, 2.75)
  g.add(bubble)

  const sill = new Mesh(new BoxGeometry(0.98, 0.06, 2.35), frame)
  sill.position.set(0, 0.3, 2.75)
  g.add(sill)

  return g
}

// ---------------------------------------------------------------------------
// Wings — ONE shape, mirrored, F-35 clipped-delta planform
// ---------------------------------------------------------------------------

/**
 * Top-down F-35 wing (half):
 *   span tip ≈ 5.35 m from centerline
 *   LE sweep, clipped tip, straight-ish TE with flaperon integrated in outline
 *   LERX blended into root LE (no separate floating box)
 *
 * Shape coords (before extrude): X = outboard, Y = forward (+ toward nose)
 * Extrude depth = thickness, then lay flat.
 */
function buildWingPair(mat: MeshStandardMaterial): Group {
  const g = new Group()
  g.add(buildWingHalf(1, mat))
  g.add(buildWingHalf(-1, mat))
  return g
}

function buildWingHalf(side: 1 | -1, mat: MeshStandardMaterial): Mesh {
  // Real F-35-ish half-planform (meters), Y forward, X outboard
  const shape = new Shape()
  // Root LE (at fuselage side, forward — LERX start)
  shape.moveTo(0.55, 2.6)
  // LERX curve out then into main LE
  shape.lineTo(1.15, 2.35)
  shape.lineTo(1.7, 1.7)
  // Main LE to tip
  shape.lineTo(5.35, 0.05)
  // Clipped tip
  shape.lineTo(5.35, -0.55)
  shape.lineTo(5.05, -1.15)
  // Trailing edge back to root (slight crank like flaperon hinge line)
  shape.lineTo(3.2, -1.85)
  shape.lineTo(1.4, -2.35)
  shape.lineTo(0.6, -2.45)
  // Root TE → close along fuselage
  shape.lineTo(0.55, 2.6)

  const geo = new ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.035,
    bevelSegments: 2,
  })
  // Center thickness
  geo.translate(0, 0, -0.07)

  const mesh = new Mesh(geo, mat)
  // Lay flat: shape XY → XZ plane (Y of shape = forward Z)
  mesh.rotation.x = -Math.PI / 2
  if (side < 0) mesh.scale.x = -1
  mesh.position.set(0, 0.0, -0.1)
  // Tiny anhedral/dihedral
  mesh.rotation.z = side * 0.025
  return mesh
}

// ---------------------------------------------------------------------------
// Horizontal tails — aft only, paired, clear of main wing
// ---------------------------------------------------------------------------

function buildHStabPair(mat: MeshStandardMaterial): Group {
  const g = new Group()
  g.add(buildHStabHalf(1, mat))
  g.add(buildHStabHalf(-1, mat))
  return g
}

function buildHStabHalf(side: 1 | -1, mat: MeshStandardMaterial): Mesh {
  // Smaller all-moving tail, sits behind main wing TE
  const shape = new Shape()
  shape.moveTo(0.35, 0.55) // root LE
  shape.lineTo(2.05, 0.05) // tip LE
  shape.lineTo(1.95, -0.45) // tip TE
  shape.lineTo(0.35, -0.7) // root TE
  shape.closePath()

  const geo = new ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.02,
    bevelSegments: 1,
  })
  geo.translate(0, 0, -0.045)

  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  if (side < 0) mesh.scale.x = -1
  // Aft of main wing, on sides of rear fuse (ahead of twin tails)
  mesh.position.set(0, 0.22, -4.9)
  return mesh
}

// ---------------------------------------------------------------------------
// Vertical tails — upright, canted, attached
// ---------------------------------------------------------------------------

/**
 * Vertical stabilizers — upright plates (X=thickness, Y=height, Z=chord).
 * Base fairing sits on the rear deck; no extrude/rotation chain that
 * produced floating slabs.
 */
function buildVStab(side: 1 | -1, skin: MeshStandardMaterial, detail: MeshStandardMaterial): Group {
  const g = new Group()

  const fin = new Mesh(new BoxGeometry(0.1, 1.95, 1.2), skin)
  fin.position.set(0, 0.975, -0.05)

  const le = new Mesh(new BoxGeometry(0.09, 1.85, 0.35), skin)
  le.position.set(0, 0.95, 0.55)
  le.rotation.x = -0.12

  const rudder = new Mesh(new BoxGeometry(0.08, 1.1, 0.28), detail)
  rudder.position.set(0, 0.85, -0.7)

  const fairing = new Mesh(new BoxGeometry(0.28, 0.22, 0.9), skin)
  fairing.position.set(0, 0.08, 0.0)

  const pivot = new Group()
  pivot.add(fin, le, rudder, fairing)
  pivot.position.set(side * 0.62, 0.38, -5.15)
  pivot.rotation.z = side * -0.42
  pivot.rotation.y = side * 0.08

  g.add(pivot)
  return g
}

// ---------------------------------------------------------------------------
// Intakes / nozzle
// ---------------------------------------------------------------------------

function buildIntake(
  side: 1 | -1,
  skin: MeshStandardMaterial,
  mid: MeshStandardMaterial,
  black: MeshStandardMaterial,
): Group {
  const g = new Group()

  const body = new Mesh(new BoxGeometry(0.65, 0.52, 2.1), mid)
  body.position.set(side * 0.88, -0.1, 1.2)
  body.rotation.y = side * 0.06
  g.add(body)

  const cheek = new Mesh(new BoxGeometry(0.28, 0.4, 1.6), skin)
  cheek.position.set(side * 1.18, -0.02, 1.05)
  cheek.rotation.y = side * 0.15
  g.add(cheek)

  const bump = new Mesh(new SphereGeometry(0.34, 12, 8, 0, Math.PI), skin)
  bump.scale.set(0.5, 0.35, 1.05)
  bump.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
  bump.position.set(side * 0.72, 0.1, 1.4)
  g.add(bump)

  const lip = new Mesh(new BoxGeometry(0.7, 0.08, 0.22), black)
  lip.position.set(side * 0.88, 0.1, 2.2)
  g.add(lip)

  const inlet = new Mesh(new BoxGeometry(0.45, 0.34, 0.12), black)
  inlet.position.set(side * 0.88, -0.06, 2.28)
  g.add(inlet)

  return g
}

function buildNozzle(
  outer: MeshStandardMaterial,
  black: MeshStandardMaterial,
  glow: MeshStandardMaterial,
): Group {
  const g = new Group()
  // Fuselage rear ~ z=-6.45 — sleeve starts inside the taper so there is no gap
  const zJoin = -6.2

  const sleeve = new Mesh(new CylinderGeometry(0.5, 0.48, 0.55, 20), outer)
  sleeve.rotation.x = Math.PI / 2
  sleeve.position.set(0, 0.02, zJoin)
  g.add(sleeve)

  const housing = new Mesh(new CylinderGeometry(0.48, 0.44, 0.7, 20), outer)
  housing.rotation.x = Math.PI / 2
  housing.position.set(0, 0.02, zJoin - 0.55)
  g.add(housing)

  const petal = new Mesh(new CylinderGeometry(0.5, 0.42, 0.18, 16), black)
  petal.rotation.x = Math.PI / 2
  petal.position.set(0, 0.02, zJoin - 0.95)
  g.add(petal)

  const inner = new Mesh(new CylinderGeometry(0.32, 0.36, 0.3, 16), black)
  inner.rotation.x = Math.PI / 2
  inner.position.set(0, 0.02, zJoin - 1.05)
  g.add(inner)

  const core = new Mesh(new CylinderGeometry(0.3, 0.3, 0.05, 16), glow)
  core.rotation.x = Math.PI / 2
  core.position.set(0, 0.02, zJoin - 1.15)
  g.add(core)

  return g
}

// ---------------------------------------------------------------------------
// Gear / lights
// ---------------------------------------------------------------------------

function addGear(root: Group, strutMat: MeshStandardMaterial, tireMat: MeshStandardMaterial): void {
  const makeLeg = (x: number, z: number, tall: number, dual = false) => {
    const door = new Mesh(new BoxGeometry(0.32, 0.035, 0.65), strutMat)
    door.position.set(x, -0.5, z)
    root.add(door)

    const leg = new Mesh(new CylinderGeometry(0.04, 0.05, tall, 8), strutMat)
    leg.position.set(x, -0.5 - tall / 2, z)
    root.add(leg)

    const wheel = (ox: number) => {
      const w = new Mesh(new CylinderGeometry(0.17, 0.17, 0.11, 14), tireMat)
      w.rotation.z = Math.PI / 2
      w.position.set(x + ox, -0.5 - tall, z)
      root.add(w)
    }
    if (dual) {
      wheel(-0.11)
      wheel(0.11)
    } else {
      wheel(0)
    }
  }

  makeLeg(0, 3.3, 0.92, false)
  makeLeg(-1.0, -0.6, 0.85, true)
  makeLeg(1.0, -0.6, 0.85, true)
}

function addNavLight(root: Group, x: number, y: number, z: number, color: number): void {
  const mat = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.1,
    metalness: 0.2,
    roughness: 0.4,
  })
  const light = new Mesh(new SphereGeometry(0.05, 8, 8), mat)
  light.position.set(x, y, z)
  root.add(light)
}
