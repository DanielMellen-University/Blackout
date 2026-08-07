import {
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'

const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _mat = new Matrix4()

/** Keep the runway / spawn area clear of scenery. */
const CLEAR_RADIUS = 90

/**
 * Low-poly mountains and trees for the flight area.
 * Trees use InstancedMesh for cheap draw calls.
 */
export function createScenery(): Group {
  const root = new Group()
  root.name = 'Scenery'

  root.add(createMountains())
  root.add(createTreeField())

  return root
}

function createMountains(): Group {
  const group = new Group()
  group.name = 'Mountains'

  const rock = new MeshStandardMaterial({
    color: 0x6a6e72,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  })
  const rockDark = new MeshStandardMaterial({
    color: 0x4a4e52,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  })
  const snow = new MeshStandardMaterial({
    color: 0xe8eef5,
    roughness: 0.75,
    metalness: 0.02,
    flatShading: true,
  })

  // Ring of peaks around the play area (deterministic enough, slight variation)
  const peaks: Array<{ x: number; z: number; h: number; r: number; snow: boolean }> = [
    { x: -380, z: -220, h: 140, r: 95, snow: true },
    { x: -420, z: 80, h: 110, r: 80, snow: true },
    { x: -300, z: 320, h: 95, r: 70, snow: false },
    { x: -120, z: 400, h: 160, r: 105, snow: true },
    { x: 180, z: 380, h: 125, r: 88, snow: true },
    { x: 420, z: 200, h: 150, r: 100, snow: true },
    { x: 450, z: -100, h: 100, r: 75, snow: false },
    { x: 320, z: -360, h: 135, r: 92, snow: true },
    { x: 40, z: -420, h: 90, r: 68, snow: false },
    { x: -200, z: -400, h: 175, r: 115, snow: true },
    { x: 500, z: 40, h: 80, r: 60, snow: false },
    { x: -480, z: -40, h: 120, r: 85, snow: true },
    // Far ridge extras
    { x: -550, z: 250, h: 200, r: 130, snow: true },
    { x: 560, z: -280, h: 185, r: 120, snow: true },
    { x: 100, z: 520, h: 145, r: 95, snow: true },
    { x: -50, z: -520, h: 155, r: 100, snow: true },
  ]

  for (const p of peaks) {
    const segments = 6 + Math.floor((Math.abs(p.x) + Math.abs(p.z)) % 4)
    const body = new Mesh(new ConeGeometry(p.r, p.h, segments), p.snow ? rock : rockDark)
    body.position.set(p.x, p.h * 0.5 - 2, p.z)
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    // Secondary foothill
    const foot = new Mesh(
      new ConeGeometry(p.r * 0.75, p.h * 0.45, segments),
      rockDark,
    )
    foot.position.set(p.x + p.r * 0.35, p.h * 0.22 - 1, p.z + p.r * 0.2)
    foot.castShadow = true
    foot.receiveShadow = true
    group.add(foot)

    if (p.snow) {
      const cap = new Mesh(new ConeGeometry(p.r * 0.38, p.h * 0.28, segments), snow)
      cap.position.set(p.x, p.h * 0.82, p.z)
      cap.castShadow = true
      group.add(cap)
    }
  }

  return group
}

function createTreeField(): Group {
  const group = new Group()
  group.name = 'Trees'

  const trunkMat = new MeshStandardMaterial({
    color: 0x4a3424,
    roughness: 0.9,
    metalness: 0.05,
  })
  const leafMats = [
    new MeshStandardMaterial({ color: 0x2d6b3a, roughness: 0.85, metalness: 0.02, flatShading: true }),
    new MeshStandardMaterial({ color: 0x3a7a42, roughness: 0.85, metalness: 0.02, flatShading: true }),
    new MeshStandardMaterial({ color: 0x245a30, roughness: 0.88, metalness: 0.02, flatShading: true }),
  ]

  const trunkGeo = new CylinderGeometry(0.25, 0.4, 1, 6)
  const leafGeo = new ConeGeometry(1.4, 3.2, 7)

  const count = 420
  const trunks = new InstancedMesh(trunkGeo, trunkMat, count)
  trunks.instanceMatrix.setUsage(DynamicDrawUsage)
  trunks.castShadow = true
  trunks.receiveShadow = true

  // Three foliage batches (color variants) sharing one placement pass
  const foliage: InstancedMesh[] = leafMats.map((mat) => {
    const mesh = new InstancedMesh(leafGeo, mat, count)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  })

  let placed = 0
  let attempts = 0
  const maxAttempts = count * 8

  // Seeded-ish scatter using simple hash so reloads look stable
  while (placed < count && attempts < maxAttempts) {
    attempts++
    const a = hash2(placed, attempts) * Math.PI * 2
    const r = 100 + hash2(attempts, placed) * 700
    const x = Math.cos(a) * r + (hash2(placed * 3, 1) - 0.5) * 40
    const z = Math.sin(a) * r + (hash2(placed * 5, 2) - 0.5) * 40

    if (Math.hypot(x, z) < CLEAR_RADIUS) continue
    // Keep a corridor along runway (z axis strip)
    if (Math.abs(x) < 28 && Math.abs(z) < 100) continue

    const s = 0.7 + hash2(placed, 9) * 1.8
    const rotY = hash2(placed, 7) * Math.PI * 2
    const variant = Math.floor(hash2(placed, 11) * foliage.length) % foliage.length

    // Trunk
    _pos.set(x, s * 0.5, z)
    _quat.setFromAxisAngle(new Vector3(0, 1, 0), rotY)
    _scale.set(s * 0.9, s, s * 0.9)
    _mat.compose(_pos, _quat, _scale)
    trunks.setMatrixAt(placed, _mat)

    // Foliage stacked above trunk; only one variant is non-zero scale at this index
    for (let v = 0; v < foliage.length; v++) {
      if (v === variant) {
        _pos.set(x, s * 0.5 + s * 1.6, z)
        _scale.set(s, s, s)
      } else {
        _pos.set(0, -1000, 0)
        _scale.set(0, 0, 0)
      }
      _mat.compose(_pos, _quat, _scale)
      foliage[v]!.setMatrixAt(placed, _mat)
    }

    placed++
  }

  // Shrink instance counts if we placed fewer than reserved
  trunks.count = placed
  for (const f of foliage) f.count = placed
  trunks.instanceMatrix.needsUpdate = true
  for (const f of foliage) f.instanceMatrix.needsUpdate = true

  group.add(trunks, ...foliage)
  return group
}

/** Deterministic 0..1 from two integers (stable tree layout across reloads). */
function hash2(a: number, b: number): number {
  let n = a * 374761393 + b * 668265263
  n = (n ^ (n >>> 13)) * 1274126177
  n = n ^ (n >>> 16)
  return (n >>> 0) / 4294967295
}
