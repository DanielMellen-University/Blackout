import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  Vector2,
} from 'three'

/**
 * Procedural F-35A - top-down planform matched to the real jet.
 * Grey airframe, black glass / tires / voids. Nose = +Z.
 */
export function createPlaceholderF35(): Group {
  const root = new Group()
  root.name = 'F35'

  // Low metalness so base color reads without an env map
  // (high metalness + no reflections = pure black / hollow look).
  const panel = panelTexture()
  const grey = makeGrey(0xb0b8c0, panel)
  const greyMid = makeGrey(0x8e97a1, panel)
  const black = solid(0x111418, 0.15, 0.65)
  const glass = solid(0x1a2838, 0.25, 0.15)
  const tire = solid(0x0c0c0e, 0.05, 0.95)
  const nozzleOuter = solid(0x2a2e34, 0.35, 0.45)
  const glowMat = new MeshStandardMaterial({
    color: 0xff5500,
    emissive: 0xff3300,
    emissiveIntensity: 0.4,
    metalness: 0.05,
    roughness: 0.6,
  })
  glowMat.name = 'nozzleGlow'

  root.add(buildFuselage(grey))
  root.add(buildCanopy(glass, black))
  root.add(buildWingPair(grey))
  root.add(buildHStabPair(grey))
  root.add(buildVStab(1, grey, black))
  root.add(buildVStab(-1, grey, black))
  root.add(buildIntake(1, grey, greyMid, black))
  root.add(buildIntake(-1, grey, greyMid, black))
  root.add(buildNozzle(nozzleOuter, black, glowMat))
  root.add(buildAfterburner())

  const eots = new Mesh(new SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), black)
  eots.scale.set(0.9, 0.48, 1.0)
  eots.position.set(0, -0.34, 5.0)
  root.add(eots)

  const bay = new Mesh(new BoxGeometry(1.05, 0.06, 4.4), greyMid)
  bay.position.set(0, -0.54, 0.2)
  root.add(bay)

  root.add(buildGear(black, tire))
  addNavLight(root, -5.35, 0.02, -0.5, 0xff2020)
  addNavLight(root, 5.35, 0.02, -0.5, 0x20ff40)
  addNavLight(root, 0, 1.5, -5.5, 0xfff5e0)

  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })

  return root
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function solid(color: number, metalness: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    metalness,
    roughness,
    transparent: false,
    depthWrite: true,
  })
}

function makeGrey(color: number, map: CanvasTexture): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    map,
    metalness: 0.12,
    roughness: 0.62,
    transparent: false,
    depthWrite: true,
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
  // Length stays unscaled so the nozzle stays attached.
  // Profile radii are a bit fuller so the body isn't a skinny tube.
  const pts: Vector2[] = [
    new Vector2(0.01, 7.15),
    new Vector2(0.28, 6.65),
    new Vector2(0.5, 5.85),
    new Vector2(0.68, 4.9),
    new Vector2(0.82, 3.7),
    new Vector2(0.94, 2.1),
    new Vector2(1.0, 0.4),
    new Vector2(1.02, -1.0),
    new Vector2(0.96, -2.5),
    new Vector2(0.84, -4.0),
    new Vector2(0.7, -5.2),
    new Vector2(0.58, -5.95),
    new Vector2(0.52, -6.45), // mates with nozzle
  ]
  const mesh = new Mesh(new LatheGeometry(pts, 36), mat)
  mesh.rotation.x = Math.PI / 2
  // Local X = width, Y = length (→ world Z), Z = height (→ world -Y)
  // Mild oval only - was 0.78 height and looked unnaturally thin
  mesh.scale.set(1.12, 1, 0.95)
  return mesh
}

/**
 * Closed solid canopy - full ellipsoid (not open hemisphere).
 * Bottom is buried in the black sill so you never see a hollow shell.
 */
function buildCanopy(glass: MeshStandardMaterial, frame: MeshStandardMaterial): Group {
  const g = new Group()

  // Full sphere → solid shell; non-uniform scale = long jet bubble
  const bubble = new Mesh(new SphereGeometry(0.55, 28, 20), glass)
  bubble.scale.set(0.78, 0.62, 1.85)
  bubble.position.set(0, 0.22, 2.7) // lower so bottom sits in sill/fuse
  g.add(bubble)

  // Thick black sill hides the lower half of the sphere
  const sill = new Mesh(new BoxGeometry(1.05, 0.18, 2.85), frame)
  sill.position.set(0, 0.18, 2.7)
  g.add(sill)

  for (const s of [-1, 1] as const) {
    const rail = new Mesh(new BoxGeometry(0.08, 0.14, 2.5), frame)
    rail.position.set(s * 0.52, 0.32, 2.7)
    rail.rotation.z = s * -0.35
    g.add(rail)
  }

  const rear = new Mesh(new BoxGeometry(0.8, 0.18, 0.5), frame)
  rear.position.set(0, 0.34, 1.45)
  rear.rotation.x = 0.3
  g.add(rear)

  const coaming = new Mesh(new BoxGeometry(0.5, 0.1, 0.45), frame)
  coaming.position.set(0, 0.26, 4.0)
  g.add(coaming)

  return g
}

// ---------------------------------------------------------------------------
// Wings - ONE shape, mirrored, F-35 clipped-delta planform
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
  // Root LE (at fuselage side, forward - LERX start)
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
// Horizontal tails - aft only, paired, clear of main wing
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
// Vertical tails - upright, canted, attached
// ---------------------------------------------------------------------------

/**
 * Vertical stabilizers - upright plates (X=thickness, Y=height, Z=chord).
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
  // Fuselage rear ~ z=-6.45 - sleeve starts inside the taper so there is no gap
  const zJoin = -6.2

  // Slightly larger to match the fuller rear fuselage
  const sleeve = new Mesh(new CylinderGeometry(0.58, 0.55, 0.55, 20), outer)
  sleeve.rotation.x = Math.PI / 2
  sleeve.position.set(0, 0.02, zJoin)
  g.add(sleeve)

  const housing = new Mesh(new CylinderGeometry(0.55, 0.5, 0.7, 20), outer)
  housing.rotation.x = Math.PI / 2
  housing.position.set(0, 0.02, zJoin - 0.55)
  g.add(housing)

  const petal = new Mesh(new CylinderGeometry(0.56, 0.48, 0.18, 16), black)
  petal.rotation.x = Math.PI / 2
  petal.position.set(0, 0.02, zJoin - 0.95)
  g.add(petal)

  const inner = new Mesh(new CylinderGeometry(0.36, 0.4, 0.3, 16), black)
  inner.rotation.x = Math.PI / 2
  inner.position.set(0, 0.02, zJoin - 1.05)
  g.add(inner)

  const core = new Mesh(new CylinderGeometry(0.34, 0.34, 0.05, 16), glow)
  core.rotation.x = Math.PI / 2
  core.position.set(0, 0.02, zJoin - 1.15)
  g.add(core)

  return g
}

// ---------------------------------------------------------------------------
// Gear / lights
// ---------------------------------------------------------------------------

/** Landing gear group — Aircraft toggles visibility with gearDown. */
function buildGear(strutMat: MeshStandardMaterial, tireMat: MeshStandardMaterial): Group {
  const gear = new Group()
  gear.name = 'landingGear'

  const makeLeg = (x: number, z: number, tall: number, dual = false) => {
    const door = new Mesh(new BoxGeometry(0.32, 0.035, 0.65), strutMat)
    door.position.set(x, -0.5, z)
    gear.add(door)

    const leg = new Mesh(new CylinderGeometry(0.04, 0.05, tall, 8), strutMat)
    leg.position.set(x, -0.5 - tall / 2, z)
    gear.add(leg)

    const wheel = (ox: number) => {
      const w = new Mesh(new CylinderGeometry(0.17, 0.17, 0.11, 14), tireMat)
      w.rotation.z = Math.PI / 2
      w.position.set(x + ox, -0.5 - tall, z)
      gear.add(w)
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
  return gear
}

/**
 * Afterburner plume behind the nozzle. Group origin = nozzle lip so
 * scale (from Aircraft) grows aft instead of dragging the flame forward.
 * Nose = +Z, exhaust = −Z.
 */
function buildAfterburner(): Group {
  const ab = new Group()
  ab.name = 'afterburner'
  ab.visible = false
  // Nozzle core sits at zJoin - 1.15 ≈ -7.35 (see buildNozzle)
  ab.position.set(0, 0.02, -7.35)

  const coreMat = new MeshBasicMaterial({
    color: 0xfff0c0,
    transparent: true,
    opacity: 0.95,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  coreMat.name = 'abCore'
  const midMat = new MeshBasicMaterial({
    color: 0xff6622,
    transparent: true,
    opacity: 0.65,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  midMat.name = 'abMid'
  const outerMat = new MeshBasicMaterial({
    color: 0xff2200,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  outerMat.name = 'abOuter'

  // Cone tip = +Y by default. rot.x = −π/2 → tip points −Z (aft).
  // Center each cone so the base sits at the nozzle (local z≈0) and tip extends aft.
  const placeCone = (
    radius: number,
    height: number,
    mat: MeshBasicMaterial,
    name: string,
  ): Mesh => {
    const mesh = new Mesh(new ConeGeometry(radius, height, 12, 1, true), mat)
    mesh.rotation.x = -Math.PI / 2
    // After rot: tip at local z = −height/2 relative to mesh origin → put origin at −height/2
    // so base ≈ 0 and tip ≈ −height
    mesh.position.set(0, 0, -height * 0.5)
    mesh.name = name
    return mesh
  }

  ab.add(placeCone(0.2, 1.5, coreMat, 'abCoreMesh'))
  ab.add(placeCone(0.36, 2.4, midMat, 'abMidMesh'))
  ab.add(placeCone(0.52, 3.4, outerMat, 'abOuterMesh'))

  return ab
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
