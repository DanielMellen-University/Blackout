/**
 * Shared low-poly vegetation kits for terrain chunks.
 * Multi-part plants (trunk + stacked canopy) via instanced placement helpers.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { hash2 } from './noise'
import type { Biome } from './terrainSample'

const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _mat = new Matrix4()
const _Y = new Vector3(0, 1, 0)
const _X = new Vector3(1, 0, 0)
const _Z = new Vector3(0, 0, 1)
const _q2 = new Quaternion()

export interface VegBuckets {
  group: Group
  finalize: () => void
  place: (
    biome: Biome,
    x: number,
    y: number,
    z: number,
    seed: number,
    nearWater: boolean,
  ) => boolean
}

function mat(color: number, roughness = 0.86): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    flatShading: true,
  })
}

function mesh(
  geo: ConeGeometry | CylinderGeometry | SphereGeometry | IcosahedronGeometry | DodecahedronGeometry,
  material: MeshStandardMaterial,
  max: number,
): InstancedMesh {
  const m = new InstancedMesh(geo, material, max)
  m.instanceMatrix.setUsage(DynamicDrawUsage)
  m.castShadow = false
  m.receiveShadow = false
  m.count = 0
  m.frustumCulled = true
  return m
}

function setAt(
  inst: InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotY: number,
  leanX = 0,
  leanZ = 0,
): void {
  _quat.setFromAxisAngle(_Y, rotY)
  if (leanX !== 0) {
    _q2.setFromAxisAngle(_X, leanX)
    _quat.multiply(_q2)
  }
  if (leanZ !== 0) {
    _q2.setFromAxisAngle(_Z, leanZ)
    _quat.multiply(_q2)
  }
  _pos.set(x, y, z)
  _scale.set(sx, sy, sz)
  _mat.compose(_pos, _quat, _scale)
  inst.setMatrixAt(index, _mat)
}

/** Build reusable veg kits for one terrain system (shared geos/mats). */
export function createVegetationFactory(): {
  createBuckets: () => VegBuckets
  disposeShared: () => void
} {
  // --- geometries (shared) ---
  const trunkGeo = new CylinderGeometry(0.18, 0.32, 1, 6)
  const pineConeGeo = new ConeGeometry(1, 1.6, 7)
  const canopySphereGeo = new SphereGeometry(1, 7, 5)
  const canopyFlatGeo = new SphereGeometry(1, 8, 4)
  const bushGeo = new SphereGeometry(1, 6, 4)
  const rockGeo = new DodecahedronGeometry(1, 0)
  const cactusBodyGeo = new CylinderGeometry(0.28, 0.34, 1, 7)
  const cactusArmGeo = new CylinderGeometry(0.14, 0.16, 0.55, 6)
  const reedGeo = new CylinderGeometry(0.04, 0.07, 1, 4)
  const grassGeo = new ConeGeometry(0.22, 1, 4)
  const deadGeo = new CylinderGeometry(0.12, 0.2, 1, 5)

  // --- materials ---
  const trunkMat = mat(0x5c4030, 0.92)
  const trunkDarkMat = mat(0x3d2a1c, 0.93)
  const pineMat = mat(0x1f4d32, 0.88)
  const pineLightMat = mat(0x2d6b42, 0.86)
  const oakMat = mat(0x3a7a38, 0.84)
  const birchCanopyMat = mat(0x5a9a48, 0.82)
  const autumnMat = mat(0x8a6a28, 0.85)
  const rfCanopyMat = mat(0x0d4a28, 0.8)
  const rfCanopy2Mat = mat(0x1a6035, 0.82)
  const bushMat = mat(0x3d6b2e, 0.88)
  const bushDryMat = mat(0x6a7a3a, 0.9)
  const snowPineMat = mat(0xc8d8e0, 0.78)
  const rockMat = mat(0x6a6e72, 0.94)
  const mesaRockMat = mat(0xc45a28, 0.88)
  const cactusMat = mat(0x3f8a48, 0.78)
  const reedMat = mat(0x4a6a30, 0.9)
  const grassMat = mat(0x4f9a3a, 0.9)
  const grassDryMat = mat(0x8a9a48, 0.92)
  const deadMat = mat(0x6a5540, 0.94)

  const sharedGeos = [
    trunkGeo,
    pineConeGeo,
    canopySphereGeo,
    canopyFlatGeo,
    bushGeo,
    rockGeo,
    cactusBodyGeo,
    cactusArmGeo,
    reedGeo,
    grassGeo,
    deadGeo,
  ]
  const sharedMats = [
    trunkMat,
    trunkDarkMat,
    pineMat,
    pineLightMat,
    oakMat,
    birchCanopyMat,
    autumnMat,
    rfCanopyMat,
    rfCanopy2Mat,
    bushMat,
    bushDryMat,
    snowPineMat,
    rockMat,
    mesaRockMat,
    cactusMat,
    reedMat,
    grassMat,
    grassDryMat,
    deadMat,
  ]

  function createBuckets(): VegBuckets {
    const group = new Group()
    group.name = 'Vegetation'

    const MAX = {
      trunk: 90,
      pine: 70,
      canopy: 50,
      rf: 40,
      bush: 45,
      rock: 28,
      mesa: 22,
      cactus: 24,
      cactusArm: 24,
      reed: 40,
      grass: 55,
      dead: 16,
    }

    const trunks = mesh(trunkGeo, trunkMat, MAX.trunk)
    const trunksDark = mesh(trunkGeo, trunkDarkMat, MAX.trunk)
    const pineA = mesh(pineConeGeo, pineMat, MAX.pine)
    const pineB = mesh(pineConeGeo, pineLightMat, MAX.pine)
    const canopyOak = mesh(canopySphereGeo, oakMat, MAX.canopy)
    const canopyBirch = mesh(canopySphereGeo, birchCanopyMat, MAX.canopy)
    const canopyAutumn = mesh(canopySphereGeo, autumnMat, MAX.canopy)
    const rfCanopy = mesh(canopyFlatGeo, rfCanopyMat, MAX.rf)
    const rfCanopy2 = mesh(canopyFlatGeo, rfCanopy2Mat, MAX.rf)
    const snowPine = mesh(pineConeGeo, snowPineMat, MAX.pine)
    const bushes = mesh(bushGeo, bushMat, MAX.bush)
    const bushesDry = mesh(bushGeo, bushDryMat, MAX.bush)
    const rocks = mesh(rockGeo, rockMat, MAX.rock)
    const mesaRocks = mesh(rockGeo, mesaRockMat, MAX.mesa)
    const cacti = mesh(cactusBodyGeo, cactusMat, MAX.cactus)
    const cactusArms = mesh(cactusArmGeo, cactusMat, MAX.cactusArm)
    const reeds = mesh(reedGeo, reedMat, MAX.reed)
    const grass = mesh(grassGeo, grassMat, MAX.grass)
    const grassDry = mesh(grassGeo, grassDryMat, MAX.grass)
    const dead = mesh(deadGeo, deadMat, MAX.dead)

    const all = [
      trunks,
      trunksDark,
      pineA,
      pineB,
      canopyOak,
      canopyBirch,
      canopyAutumn,
      rfCanopy,
      rfCanopy2,
      snowPine,
      bushes,
      bushesDry,
      rocks,
      mesaRocks,
      cacti,
      cactusArms,
      reeds,
      grass,
      grassDry,
      dead,
    ]

    let nTrunk = 0
    let nTrunkD = 0
    let nPineA = 0
    let nPineB = 0
    let nOak = 0
    let nBirch = 0
    let nAutumn = 0
    let nRf = 0
    let nRf2 = 0
    let nSnow = 0
    let nBush = 0
    let nBushDry = 0
    let nRock = 0
    let nMesa = 0
    let nCactus = 0
    let nCactusArm = 0
    let nReed = 0
    let nGrass = 0
    let nGrassDry = 0
    let nDead = 0

    function placePine(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      snow: boolean,
      seed: number,
    ): boolean {
      if (nTrunk >= MAX.trunk) return false
      const leanX = (hash2(seed, 21) - 0.5) * 0.12
      const leanZ = (hash2(seed, 22) - 0.5) * 0.12
      const trunkH = s * 2.4
      setAt(trunks, nTrunk++, x, y + trunkH * 0.45, z, s * 0.35, trunkH, s * 0.35, rot, leanX, leanZ)

      // 3 stacked cones
      const layers = [
        { y: 0.55, r: 1.15, h: 1.1 },
        { y: 1.15, r: 0.85, h: 1.0 },
        { y: 1.65, r: 0.55, h: 0.85 },
      ]
      for (let L = 0; L < layers.length; L++) {
        const layer = layers[L]!
        const useLight = hash2(seed, 30 + L) > 0.55
        const target = snow ? snowPine : useLight ? pineB : pineA
        let idx: number
        if (snow) {
          if (nSnow >= MAX.pine) break
          idx = nSnow++
        } else if (useLight) {
          if (nPineB >= MAX.pine) break
          idx = nPineB++
        } else {
          if (nPineA >= MAX.pine) break
          idx = nPineA++
        }
        setAt(
          target,
          idx,
          x,
          y + trunkH * 0.35 + s * layer.y,
          z,
          s * layer.r,
          s * layer.h,
          s * layer.r,
          rot + L * 0.4,
          leanX,
          leanZ,
        )
      }
      return true
    }

    function placeDeciduous(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      seed: number,
    ): boolean {
      const kind = hash2(seed, 40)
      const useDark = kind > 0.7
      if (useDark ? nTrunkD >= MAX.trunk : nTrunk >= MAX.trunk) return false
      const leanX = (hash2(seed, 41) - 0.5) * 0.1
      const leanZ = (hash2(seed, 42) - 0.5) * 0.1
      const trunkH = s * (1.4 + kind * 0.6)
      setAt(
        useDark ? trunksDark : trunks,
        useDark ? nTrunkD++ : nTrunk++,
        x,
        y + trunkH * 0.5,
        z,
        s * 0.28,
        trunkH,
        s * 0.28,
        rot,
        leanX,
        leanZ,
      )

      let canopy: InstancedMesh
      let idx: number
      if (kind < 0.4) {
        if (nOak >= MAX.canopy) return true
        canopy = canopyOak
        idx = nOak++
      } else if (kind < 0.75) {
        if (nBirch >= MAX.canopy) return true
        canopy = canopyBirch
        idx = nBirch++
      } else {
        if (nAutumn >= MAX.canopy) return true
        canopy = canopyAutumn
        idx = nAutumn++
      }

      const cy = y + trunkH * 0.85 + s * 0.55
      setAt(canopy, idx, x, cy, z, s * 1.15, s * 0.95, s * 1.15, rot, leanX * 0.5, leanZ * 0.5)
      // Second lobe for fuller crown
      if (hash2(seed, 43) > 0.45) {
        let idx2: number
        if (kind < 0.4 && nOak < MAX.canopy) {
          idx2 = nOak++
          setAt(
            canopyOak,
            idx2,
            x + Math.cos(rot) * s * 0.35,
            cy + s * 0.15,
            z + Math.sin(rot) * s * 0.35,
            s * 0.75,
            s * 0.65,
            s * 0.75,
            rot + 1,
          )
        } else if (kind >= 0.4 && kind < 0.75 && nBirch < MAX.canopy) {
          idx2 = nBirch++
          setAt(
            canopyBirch,
            idx2,
            x + Math.cos(rot) * s * 0.3,
            cy + s * 0.1,
            z + Math.sin(rot) * s * 0.3,
            s * 0.7,
            s * 0.6,
            s * 0.7,
            rot + 0.8,
          )
        }
      }
      return true
    }

    function placeRainforest(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      seed: number,
    ): boolean {
      if (nTrunkD >= MAX.trunk) return false
      const trunkH = s * 3.2
      setAt(trunksDark, nTrunkD++, x, y + trunkH * 0.5, z, s * 0.4, trunkH, s * 0.4, rot)

      const cy = y + trunkH * 0.92
      if (nRf < MAX.rf) {
        setAt(rfCanopy, nRf++, x, cy, z, s * 1.8, s * 0.7, s * 1.8, rot)
      }
      if (nRf2 < MAX.rf && hash2(seed, 50) > 0.35) {
        setAt(
          rfCanopy2,
          nRf2++,
          x + Math.cos(rot) * s * 0.5,
          cy - s * 0.15,
          z + Math.sin(rot) * s * 0.5,
          s * 1.2,
          s * 0.5,
          s * 1.2,
          rot + 1.2,
        )
      }
      return true
    }

    function placeBushAt(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      dry: boolean,
      seed: number,
    ): boolean {
      const inst = dry ? bushesDry : bushes
      let idx = dry ? nBushDry : nBush
      if (idx >= MAX.bush) return false
      if (dry) nBushDry++
      else nBush++
      setAt(inst, idx, x, y + s * 0.45, z, s, s * 0.75, s, rot)
      if (hash2(seed, 60) > 0.4) {
        let idx2 = dry ? nBushDry : nBush
        if (idx2 >= MAX.bush) return true
        if (dry) nBushDry++
        else nBush++
        setAt(
          inst,
          idx2,
          x + Math.cos(rot) * s * 0.4,
          y + s * 0.35,
          z + Math.sin(rot) * s * 0.4,
          s * 0.7,
          s * 0.55,
          s * 0.7,
          rot + 1,
        )
      }
      return true
    }

    function placeGrassClump(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      dry: boolean,
      seed: number,
    ): boolean {
      const inst = dry ? grassDry : grass
      let placed = 0
      for (let k = 0; k < 3; k++) {
        let idx = dry ? nGrassDry : nGrass
        if (idx >= MAX.grass) break
        if (dry) nGrassDry++
        else nGrass++
        const a = rot + k * 2.1 + hash2(seed, 70 + k)
        const r = s * 0.15 * k
        setAt(
          inst,
          idx,
          x + Math.cos(a) * r,
          y + s * 0.45,
          z + Math.sin(a) * r,
          s * (0.5 + k * 0.1),
          s * (0.85 + hash2(seed, 80 + k) * 0.4),
          s * (0.5 + k * 0.1),
          a,
        )
        placed++
      }
      return placed > 0
    }

    function placeCactusAt(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      seed: number,
    ): boolean {
      if (nCactus >= MAX.cactus) return false
      const h = s * 2.2
      setAt(cacti, nCactus++, x, y + h * 0.5, z, s * 0.9, h, s * 0.9, rot)
      if (hash2(seed, 90) > 0.4 && nCactusArm < MAX.cactusArm) {
        const side = hash2(seed, 91) > 0.5 ? 1 : -1
        setAt(
          cactusArms,
          nCactusArm++,
          x + Math.cos(rot) * s * 0.45 * side,
          y + h * 0.55,
          z + Math.sin(rot) * s * 0.45 * side,
          s * 0.7,
          s * 0.9,
          s * 0.7,
          rot,
          0,
          side * 0.9,
        )
      }
      return true
    }

    function placeReedClump(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      seed: number,
    ): boolean {
      let ok = false
      for (let k = 0; k < 4; k++) {
        if (nReed >= MAX.reed) break
        const a = rot + k * 1.5
        const r = 0.12 * s * k
        const hh = s * (1.2 + hash2(seed, 100 + k) * 0.8)
        setAt(
          reeds,
          nReed++,
          x + Math.cos(a) * r,
          y + hh * 0.5,
          z + Math.sin(a) * r,
          s * 0.35,
          hh,
          s * 0.35,
          a,
        )
        ok = true
      }
      return ok
    }

    function placeRockAt(
      x: number,
      y: number,
      z: number,
      s: number,
      rot: number,
      mesa: boolean,
      seed: number,
    ): boolean {
      if (mesa) {
        if (nMesa >= MAX.mesa) return false
        const sy = s * (0.5 + hash2(seed, 110) * 0.7)
        setAt(mesaRocks, nMesa++, x, y + sy * 0.4, z, s, sy, s * 0.9, rot)
      } else {
        if (nRock >= MAX.rock) return false
        const sy = s * (0.45 + hash2(seed, 111) * 0.8)
        setAt(rocks, nRock++, x, y + sy * 0.4, z, s, sy, s * 0.95, rot)
      }
      return true
    }

    function placeDeadAt(x: number, y: number, z: number, s: number, rot: number): boolean {
      if (nDead >= MAX.dead) return false
      const leanX = 0.3 + hash2(Math.floor(x), Math.floor(z)) * 0.5
      setAt(dead, nDead++, x, y + s * 0.55, z, s * 0.25, s * 1.4, s * 0.25, rot, leanX, 0.1)
      return true
    }

    const place = (
      biome: Biome,
      x: number,
      y: number,
      z: number,
      seed: number,
      nearWater: boolean,
    ): boolean => {
      const rot = hash2(seed, 3) * Math.PI * 2
      const roll = hash2(seed, 14)
      const sBase = 0.85 + hash2(seed, 9) * 0.9

      if (nearWater && roll < 0.62) {
        return placeReedClump(x, y, z, 0.9 + roll * 1.2, rot, seed)
      }

      switch (biome) {
        case 'rainforest':
          if (roll < 0.72) return placeRainforest(x, y, z, 1.3 + roll * 1.8, rot, seed)
          return placeBushAt(x, y, z, 0.9 + roll, rot, false, seed)
        case 'forest':
          if (roll < 0.55) return placePine(x, y, z, 0.9 + roll * 1.3, rot, false, seed)
          if (roll < 0.88) return placeDeciduous(x, y, z, 0.85 + roll * 1.2, rot, seed)
          if (roll < 0.95) return placeBushAt(x, y, z, 0.7 + roll * 0.6, rot, false, seed)
          return placeDeadAt(x, y, z, 0.7 + roll * 0.5, rot)
        case 'plains':
          if (roll < 0.55) return placeGrassClump(x, y, z, 0.7 + roll, rot, roll > 0.35, seed)
          if (roll < 0.8) return placeBushAt(x, y, z, 0.5 + roll * 0.7, rot, roll > 0.6, seed)
          return placeDeciduous(x, y, z, 0.55 + roll * 0.7, rot, seed)
        case 'hills':
          if (roll < 0.4) return placePine(x, y, z, 0.8 + roll * 1.1, rot, false, seed)
          if (roll < 0.65) return placeDeciduous(x, y, z, 0.75 + roll, rot, seed)
          if (roll < 0.82) return placeBushAt(x, y, z, 0.55 + roll * 0.5, rot, false, seed)
          return placeRockAt(x, y, z, 0.9 + roll * 2.2, rot, false, seed)
        case 'swamp':
          if (roll < 0.5) return placeReedClump(x, y, z, 1.0 + roll, rot, seed)
          if (roll < 0.8) return placeDeciduous(x, y, z, 0.55 + roll * 0.8, rot, seed)
          return placeDeadAt(x, y, z, 0.6 + roll * 0.5, rot)
        case 'snow':
          if (roll < 0.65) return placePine(x, y, z, 0.65 + roll * 1.0, rot, true, seed)
          return placeRockAt(x, y, z, 1.0 + roll * 2.5, rot, false, seed)
        case 'mountain':
          if (y < 280 && roll < 0.35)
            return placePine(x, y, z, 0.5 + roll * 0.8, rot, y > 200, seed)
          return placeRockAt(x, y, z, 1.2 + roll * 3.5, rot, false, seed)
        case 'mesa':
          if (y > 25) return placeRockAt(x, y, z, 1.4 + roll * 4, rot, true, seed)
          return false
        case 'desert':
          if (roll < 0.7) return placeCactusAt(x, y, z, 0.8 + roll * 1.2, rot, seed)
          return placeRockAt(x, y, z, 0.7 + roll * 1.8, rot, false, seed)
        default:
          return placeGrassClump(x, y, z, sBase * 0.7, rot, false, seed)
      }
    }

    const finalize = (): void => {
      trunks.count = nTrunk
      trunksDark.count = nTrunkD
      pineA.count = nPineA
      pineB.count = nPineB
      canopyOak.count = nOak
      canopyBirch.count = nBirch
      canopyAutumn.count = nAutumn
      rfCanopy.count = nRf
      rfCanopy2.count = nRf2
      snowPine.count = nSnow
      bushes.count = nBush
      bushesDry.count = nBushDry
      rocks.count = nRock
      mesaRocks.count = nMesa
      cacti.count = nCactus
      cactusArms.count = nCactusArm
      reeds.count = nReed
      grass.count = nGrass
      grassDry.count = nGrassDry
      dead.count = nDead

      for (const m of all) {
        m.instanceMatrix.needsUpdate = true
        if (m.count > 0) group.add(m)
      }
    }

    return { group, finalize, place }
  }

  return {
    createBuckets,
    disposeShared: () => {
      for (const g of sharedGeos) g.dispose()
      for (const m of sharedMats) m.dispose()
    },
  }
}

export function vegetationDensity(
  biome: Biome,
  moisture: number,
  f: { river: number; lake: number; pond: number; stream: number },
): number {
  let d = 0.2
  switch (biome) {
    case 'rainforest':
      d = 0.9
      break
    case 'forest':
      d = 0.78 + moisture * 0.08
      break
    case 'swamp':
      d = 0.68
      break
    case 'plains':
      d = 0.48
      break
    case 'hills':
      d = 0.5
      break
    case 'desert':
      d = 0.36
      break
    case 'mesa':
      d = 0.32
      break
    case 'mountain':
      d = 0.4
      break
    case 'snow':
      d = 0.3
      break
    default:
      d = 0.25
  }
  if (f.lake > 0.3 || f.pond > 0.4 || f.stream > 0.4) d = Math.min(1, d + 0.18)
  if (f.river > 0.2 && f.river < 0.7) d = Math.min(1, d + 0.12)
  return d
}
