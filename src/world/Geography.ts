import { clamp01, fbm, getWorldSeed, hash2, ridged, smoothstep } from './noise'
import type { Biome, Climate } from './terrainSample'

/** Continuous, seed-driven provinces. Distances and elevations are metres. */
const REGION = 9000
const RIVER_SPACING = 14000
const lakeLevels = new Map<string, number>()
let lakeSeed = Number.NaN

function alpineRelief(wx: number, wz: number, inland: number, highlands: number): number {
  const range = Math.pow(ridged(wx / 10000 + 52, wz / 10000 - 13, 2), 1.15)
  const crest = Math.pow(ridged(wx / 3400, wz / 3400, 2), 1.1)
  return range * highlands * inland * (1950 + crest * 7200)
}

/** Cache a conservative rim elevation so alpine lakes don't become kilometre-deep pits. */
function lakeElevation(cx: number, cz: number, lx: number, lz: number, size: number): number {
  if (lakeSeed !== getWorldSeed()) { lakeLevels.clear(); lakeSeed = getWorldSeed() }
  const key = `${cx},${cz}`
  const cached = lakeLevels.get(key)
  if (cached !== undefined) return cached
  let rim = Infinity
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4
    const x = lx + Math.cos(angle) * size * 1.7
    const z = lz + Math.sin(angle) * size * 1.7 * .68
    const wx = x + (fbm(x / 8200, z / 8200, 2) - .5) * 1500
    const wz = z + (fbm(x / 8200 + 71, z / 8200 - 29, 2) - .5) * 1500
    rim = Math.min(rim, alpineRelief(wx, wz, smoothstep(0, .105, continent(wx, wz) - .45),
      smoothstep(.42, .68, fbm(wx / 11000 - 123, wz / 11000 + 63, 2))))
  }
  const level = 45 + hash2(cx + 15, cz - 62) * 190 + rim * .85
  if (lakeLevels.size >= 512) lakeLevels.delete(lakeLevels.keys().next().value!)
  lakeLevels.set(key, level)
  return level
}

function continent(x: number, z: number): number {
  return fbm(x / 19000 + 13, z / 19000 - 8, 3) * .78
    + fbm(x / 5400 - 53, z / 5400 + 21, 2) * .22
}

/** A meandering drainage spine repeats in separate, seed-varied catchments. */
function riverCenter(index: number, z: number): number {
  return index * RIVER_SPACING
    + (fbm(z / 4300, index * 7 + 31, 3) - .5) * 4200
    + Math.sin(z / 750 + hash2(index, 73) * 6.28) * 160
}

function riverLevel(index: number, z: number): number {
  // The broad continental profile grades the channel down into estuaries.
  return Math.max(0, continent(riverCenter(index, z), z) - .45) * 330
}

export function sampleGeography(x: number, z: number): Climate {
  const wx = x + (fbm(x / 8200, z / 8200, 2) - .5) * 1500
  const wz = z + (fbm(x / 8200 + 71, z / 8200 - 29, 2) - .5) * 1500
  const continental = continent(wx, wz)
  const shore = continental - .45
  const land = clamp01(.36 + shore * 4.8)
  const inland = smoothstep(0, .105, shore)
  const moisture = clamp01((fbm(wx / 6800 + 30, wz / 6800 - 81, 3) - .2) * 1.7)
  const temperature = clamp01(
    (fbm(wx / 10500 - 65, wz / 10500 + 9, 3) - .2) * 1.65
    + Math.sin(z / 45000) * .15,
  )
  const dry = 1 - smoothstep(.25, .5, moisture)
  const cold = 1 - smoothstep(.27, .47, temperature)
  const hot = smoothstep(.53, .75, temperature)
  const province = fbm(wx / 7200 + 215, wz / 7200 - 130, 2)
  const badlands = dry * smoothstep(.42, .65, province)
  const dunes = dry * (1 - smoothstep(.4, .62, province))
  const highlands = smoothstep(.42, .68, fbm(wx / 11000 - 123, wz / 11000 + 63, 2))
  const range = highlands * inland
  const rolling = (fbm(wx / 1350, wz / 1350, 3) - .3) * 280
  const detail = (fbm(wx / 170, wz / 170, 2) - .5) * 6
  const lowland = 14 + Math.max(0, shore) * 190 + rolling + detail
  let height = lowland * inland
  // Wide foothills support serrated alpine ridges and high passes.
  height += alpineRelief(wx, wz, inland, highlands)
  // Humid limestone towers, wooded ridges, and cold glacial hummocks.
  // Climate weights shape the actual ground, not just its paint.
  const wet = smoothstep(.42, .76, moisture)
  const karst = Math.pow(ridged(wx / 640 + 18, wz / 640 - 92, 2), 4) * 430
  const wooded = ridged(wx / 2100 - 37, wz / 2100 + 12, 2) * 230
  const hummocks = (fbm(wx / 460 + 33, wz / 460, 2) - .3) * 100
  height += inland * (wet * hot * karst + wet * (1 - hot) * wooded
    + cold * hummocks + hot * dry * smoothstep(.35, .65, province) * 160)
  const dunePhase = wx / 95 + Math.sin(wz / 700) * 1.4 + fbm(wx / 1100, wz / 1100, 2) * 5
  const duneHeight = Math.pow((Math.sin(dunePhase) + 1) * .5, 2.4) * 90
  height += dunes * inland * duneHeight

  const mesaField = fbm(wx / 1500 + 81, wz / 1500 - 7, 3)
  const terraces = smoothstep(.3, .39, mesaField) * 90
    + smoothstep(.49, .56, mesaField) * 130
    + smoothstep(.64, .7, mesaField) * 150
  height += badlands * inland * terraces * 3
  const canyonPath = Math.abs(fbm(wx / 2600 - 100, wz / 2600 + 80, 3) - .5)
  const canyon = (1 - smoothstep(.015, .065, canyonPath)) * badlands * inland
  height -= canyon * Math.min(650, Math.max(0, height - 12))

  // Cold coastal ranges are cut into broad U-shaped fjords.
  const fjordPath = Math.abs(fbm(wx / 2400 + 14, wz / 2400 - 20, 2) - .5)
  const fjord = (1 - smoothstep(.013, .047, fjordPath)) * cold
    * (1 - smoothstep(.07, .16, shore))
  height += (-18 - height) * fjord

  // Ocean floor, continental shelves and submerged ridges share the coastline.
  if (shore < 0) {
    height = shore * 6000
    height += ridged(wx / 2200, wz / 2200, 2) * 120 * smoothstep(0, .12, -shore)
  }
  let waterLevel = 0
  let river = 0
  let lake = 0
  let volcanic = 0
  let salt = 0

  if (shore > 0) {
    const ri = Math.round(x / RIVER_SPACING)
    const center = riverCenter(ri, z)
    const distance = Math.abs(x - center)
    const width = 55 + fbm(z / 1900, ri + 49, 2) * 75
    const valley = 1 - smoothstep(width, width + 480, distance)
    river = 1 - smoothstep(width * .55, width * 1.5, distance)
    const level = riverLevel(ri, z)
    // A continuous bowl intersects its water plane at the channel edge.
    const channel = level - 5 + 5 * Math.pow(distance / width, 2)
    height += (channel - height) * valley
    if (distance < width + 480) waterLevel = level

    // Jittered landmarks are confined to their cell, so no seam or endless
    // repetition of identical mountains/lakes is introduced at region borders.
    const cx = Math.floor(x / REGION)
    const cz = Math.floor(z / REGION)
    const lx = (cx + .3 + hash2(cx + 81, cz - 9) * .4) * REGION
    const lz = (cz + .3 + hash2(cx - 71, cz + 63) * .4) * REGION
    const dx = x - lx
    const dz = z - lz
    const distanceToLandmark = Math.hypot(dx, dz)
    const kind = hash2(cx + 400, cz - 400)
    const size = 550 + hash2(cx - 133, cz + 28) * 550
    const localContinent = continent(lx, lz)
    const enabled = smoothstep(.47, .55, localContinent)
    const gate = (1 - smoothstep(size, size * 2.2, distanceToLandmark)) * enabled * inland
    if (gate > 0) {
      if (kind < .5) {
        const level = lakeElevation(cx, cz, lx, lz, size)
        const r = Math.hypot(dx / size, dz / (size * .68))
        const edge = 1 - smoothstep(1.05, 1.7, r)
        const bowl = level - 24 + 24 * r * r
        // Lake surface is one fixed elevation throughout the whole basin.
        height += (bowl - height) * edge * enabled * inland
        lake = (1 - smoothstep(.9, 1.12, r)) * enabled * inland
        if (r < 1.7 && enabled * inland > .999) waterLevel = level
      } else if (kind < .77) {
        const r = distanceToLandmark / size
        volcanic = gate
        const cone = Math.pow(Math.max(0, 1 - r / 2.2), 1.4) * 4350
        const crater = (1 - smoothstep(.18, .48, r)) * 1530
        height += gate * (cone - crater)
      } else {
        salt = gate * dry
        height += (18 + detail * .12 - height) * salt
      }
    }
  }

  let biome: Biome
  let biomeB: Biome
  let biomeMix = 0
  let biomeWeights: [Biome, number][] | undefined
  const snowLine = 3300 - cold * 1500 + hot * 1050
  if (height < waterLevel) {
    biome = waterLevel <= 0 ? 'ocean' : 'water'
    biomeB = biome
  } else {
    const alpine = smoothstep(750, 2400, height)
    const snow = smoothstep(snowLine - 300, snowLine + 720, height)
    const low = 1 - alpine
    const fitness: [Biome, number][] = [
      ['plains', .5 * low * (1 - cold * .8)],
      ['hills', smoothstep(80, 260, height) * low * .6],
      ['forest', smoothstep(.35, .66, moisture) * low * (1 - hot * .55)],
      ['rainforest', smoothstep(.48, .76, moisture) * hot * low * 1.8],
      ['swamp', smoothstep(.55, .8, moisture) * (1 - smoothstep(8, 40, height)) * 1.5],
      ['desert', dunes * low * 2],
      ['mesa', badlands * (1 - alpine * .65) * 2],
      ['savanna', hot * (1 - smoothstep(.3, .58, moisture)) * low],
      ['tundra', cold * low * 1.5],
      ['mountain', alpine * (1 - snow) * 2],
      ['snow', snow * 3],
      ['volcanic', volcanic * 3],
      ['saltflat', salt * 3],
    ]
    biome = 'plains'
    biomeB = biome
    let best = 0
    let second = 0
    for (const [candidate, weight] of fitness) {
      if (weight > best) {
        second = best; biomeB = biome; best = weight; biome = candidate
      } else if (weight > second) {
        second = weight; biomeB = candidate
      }
    }
    biomeMix = second / Math.max(.0001, best + second)
    // All contributors survive a three-way boundary; top-two selection alone
    // jumps in color when the second and third candidates trade places.
    biomeWeights = fitness
  }
  return {
    height, waterLevel, moisture, temperature, biome, biomeB, biomeMix, biomeWeights, land,
    river, coastal: (1 - smoothstep(0, .026, Math.abs(shore))) * (1 - range),
    features: { river, ravine: canyon, lake, pond: 0, stream: 0 },
  }
}
