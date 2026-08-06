import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
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
 * Procedural F-35A-inspired mesh (approx. real proportions).
 * Units: 1 unit ≈ 1 m. Nose points +Z. Length ~15.7 m, span ~11 m.
 *
 * Drop a real GLB at `public/models/f35.glb` to replace this.
 */
export function createPlaceholderF35(): Group {
  const root = new Group()
  root.name = 'F35'

  const skin = makeSkinMaterial(0x6a727a)
  const skinDark = makeSkinMaterial(0x4a525a)
  const skinEdge = makeSkinMaterial(0x3a424a)
  const intakeMat = makeSkinMaterial(0x1a1e22)
  const nozzleMat = new MeshStandardMaterial({
    color: 0x1a1816,
    metalness: 0.85,
    roughness: 0.35,
    emissive: 0x331100,
    emissiveIntensity: 0.15,
  })
  const canopyMat = new MeshStandardMaterial({
    color: 0x0a1520,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.72,
  })
  const canopyFrame = makeSkinMaterial(0x2a3038)
  const gearMat = new MeshStandardMaterial({
    color: 0x22262a,
    metalness: 0.7,
    roughness: 0.4,
  })
  const lightMat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff2cc,
    emissiveIntensity: 0.9,
  })

  root.add(buildFuselage(skin))

  const nose = new Mesh(new ConeGeometry(0.48, 2.6, 16), skin)
  nose.rotation.x = -Math.PI / 2
  nose.position.z = 6.35
  root.add(nose)

  const eots = new Mesh(new SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), skinDark)
  eots.rotation.x = Math.PI
  eots.position.set(0, -0.42, 5.4)
  root.add(eots)

  const canopy = new Mesh(new SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), canopyMat)
  canopy.scale.set(0.85, 0.72, 1.35)
  canopy.position.set(0, 0.55, 2.55)
  root.add(canopy)

  const frame = new Mesh(new BoxGeometry(1.15, 0.08, 2.4), canopyFrame)
  frame.position.set(0, 0.38, 2.5)
  root.add(frame)

  root.add(buildIntake(-1, intakeMat, skinDark))
  root.add(buildIntake(1, intakeMat, skinDark))

  root.add(buildWing(1, skin, skinEdge))
  root.add(buildWing(-1, skin, skinEdge))

  root.add(buildHStab(1, skin))
  root.add(buildHStab(-1, skin))

  root.add(buildVStab(1, skinDark, skinEdge))
  root.add(buildVStab(-1, skinDark, skinEdge))

  const nozzle = new Mesh(new CylinderGeometry(0.52, 0.46, 1.1, 16), nozzleMat)
  nozzle.rotation.x = Math.PI / 2
  nozzle.position.set(0, 0.05, -6.45)
  root.add(nozzle)

  const nozzleInner = new Mesh(new CylinderGeometry(0.38, 0.42, 0.35, 12), intakeMat)
  nozzleInner.rotation.x = Math.PI / 2
  nozzleInner.position.set(0, 0.05, -6.95)
  root.add(nozzleInner)

  const glow = new Mesh(
    new CylinderGeometry(0.36, 0.36, 0.05, 12),
    new MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.6,
    }),
  )
  glow.rotation.x = Math.PI / 2
  glow.position.set(0, 0.05, -7.05)
  root.add(glow)

  const belly = new Mesh(new BoxGeometry(1.3, 0.12, 5.5), skinDark)
  belly.position.set(0, -0.55, 0.2)
  root.add(belly)

  addGear(root, gearMat)

  const navL = new Mesh(
    new SphereGeometry(0.06, 8, 8),
    new MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.2 }),
  )
  navL.position.set(-5.3, 0.05, -0.2)
  root.add(navL)

  const navR = new Mesh(
    new SphereGeometry(0.06, 8, 8),
    new MeshStandardMaterial({ color: 0x22ff44, emissive: 0x00ff22, emissiveIntensity: 1.2 }),
  )
  navR.position.set(5.3, 0.05, -0.2)
  root.add(navR)

  const tailLight = new Mesh(new SphereGeometry(0.05, 8, 8), lightMat)
  tailLight.position.set(0, 0.9, -5.8)
  root.add(tailLight)

  root.traverse((obj: Object3D) => {
    const mesh = obj as Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })

  return root
}

function makeSkinMaterial(color: number): MeshStandardMaterial {
  const tex = panelTexture()
  return new MeshStandardMaterial({
    color,
    map: tex,
    metalness: 0.55,
    roughness: 0.42,
  })
}

function panelTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#808890'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 256)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(256, i)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  for (let i = -256; i < 256; i += 48) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 128, 256)
    ctx.stroke()
  }
  for (let i = 0; i < 800; i++) {
    const v = 100 + Math.random() * 40
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},0.15)`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(4, 4)
  return tex
}

function buildFuselage(mat: MeshStandardMaterial): Mesh {
  const pts: Vector2[] = [
    new Vector2(0.02, -6.2),
    new Vector2(0.45, -5.8),
    new Vector2(0.62, -4.5),
    new Vector2(0.72, -2.5),
    new Vector2(0.78, 0.0),
    new Vector2(0.74, 1.5),
    new Vector2(0.68, 3.0),
    new Vector2(0.55, 4.5),
    new Vector2(0.42, 5.5),
    new Vector2(0.08, 6.0),
  ]
  const geo = new LatheGeometry(pts, 24)
  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = Math.PI / 2
  mesh.scale.set(1.05, 0.82, 1)
  return mesh
}

function buildWing(side: 1 | -1, skin: MeshStandardMaterial, edge: MeshStandardMaterial): Group {
  const g = new Group()
  const shape = new Shape()
  shape.moveTo(0.6, 2.2)
  shape.lineTo(5.4, 0.35)
  shape.lineTo(5.2, -1.4)
  shape.lineTo(0.7, -2.6)
  shape.lineTo(0.6, 2.2)

  const geo = new ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.04,
    bevelSegments: 1,
  })
  const wing = new Mesh(geo, skin)
  wing.rotation.x = -Math.PI / 2
  wing.position.set(0, -0.05, -0.3)
  wing.rotation.z = side * 0.04
  if (side < 0) wing.scale.x = -1
  g.add(wing)

  const lerx = new Mesh(new BoxGeometry(1.6, 0.1, 2.2), edge)
  lerx.position.set(side * 1.3, -0.02, 1.1)
  lerx.rotation.y = side * -0.45
  g.add(lerx)

  const flap = new Mesh(new BoxGeometry(2.2, 0.06, 0.55), edge)
  flap.position.set(side * 3.2, -0.08, -2.0)
  g.add(flap)

  return g
}

function buildHStab(side: 1 | -1, skin: MeshStandardMaterial): Mesh {
  const shape = new Shape()
  shape.moveTo(0.2, 0.9)
  shape.lineTo(2.3, 0.15)
  shape.lineTo(2.2, -0.55)
  shape.lineTo(0.25, -0.85)
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false })
  const m = new Mesh(geo, skin)
  m.rotation.x = -Math.PI / 2
  m.position.set(side * 0.35, 0.12, -4.7)
  if (side < 0) m.scale.x = -1
  return m
}

function buildVStab(side: 1 | -1, skin: MeshStandardMaterial, edge: MeshStandardMaterial): Group {
  const g = new Group()
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.lineTo(0.15, 2.15)
  shape.lineTo(-1.35, 1.85)
  shape.lineTo(-1.1, 0)
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false })
  const fin = new Mesh(geo, skin)
  fin.rotation.y = Math.PI / 2
  fin.position.set(side * 0.95, 0.35, -4.5)
  fin.rotation.z = side * -0.42
  g.add(fin)

  const rudder = new Mesh(new BoxGeometry(0.08, 1.2, 0.45), edge)
  rudder.position.set(side * 1.35, 1.2, -5.15)
  rudder.rotation.z = side * -0.42
  g.add(rudder)
  return g
}

function buildIntake(side: 1 | -1, dark: MeshStandardMaterial, lip: MeshStandardMaterial): Group {
  const g = new Group()
  const body = new Mesh(new BoxGeometry(0.85, 0.7, 2.6), dark)
  body.position.set(side * 0.95, -0.15, 1.0)
  body.rotation.y = side * 0.12
  g.add(body)

  const lipMesh = new Mesh(new BoxGeometry(0.95, 0.12, 0.35), lip)
  lipMesh.position.set(side * 0.95, 0.15, 2.2)
  g.add(lipMesh)

  const bump = new Mesh(new SphereGeometry(0.45, 10, 8, 0, Math.PI), lip)
  bump.scale.set(0.7, 0.45, 1.1)
  bump.rotation.y = Math.PI / 2
  bump.position.set(side * 0.75, 0.15, 1.3)
  g.add(bump)
  return g
}

function addGear(root: Group, mat: MeshStandardMaterial): void {
  const strut = (x: number, z: number, tall: number) => {
    const leg = new Mesh(new CylinderGeometry(0.05, 0.06, tall, 6), mat)
    leg.position.set(x, -0.55 - tall / 2, z)
    root.add(leg)
    const wheel = new Mesh(new CylinderGeometry(0.2, 0.2, 0.14, 12), mat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, -0.55 - tall, z)
    root.add(wheel)
  }
  strut(0, 3.2, 0.95)
  strut(-1.15, -0.8, 0.85)
  strut(1.15, -0.8, 0.85)
}
