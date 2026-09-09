import { clamp01, fbm, hash2, smoothstep, valueNoise } from './noise'

const VOLCANO_CELL = 24000

/** Smooth mask for one rare regional volcanic cone and its summit caldera. */
function volcanicLandmark(x: number, z: number): { uplift: number; mask: number; caldera: number } {
  const cx = Math.floor(x / VOLCANO_CELL)
  const cz = Math.floor(z / VOLCANO_CELL)
  const present = hash2(cx + 417, cz - 283)
  if (present < .82) return { uplift: 0, mask: 0, caldera: 0 }

  // The center stays far enough from the cell border that the mask reaches
  // zero before the neighboring cell takes over. This preserves continuity.
  const centerX = (cx + .5) * VOLCANO_CELL + (hash2(cx - 91, cz + 51) - .5) * 7000
  const centerZ = (cz + .5) * VOLCANO_CELL + (hash2(cx + 67, cz - 33) - .5) * 7000
  const radius = 2600 + hash2(cx + 11, cz + 107) * 1500
  const distance = Math.hypot(x - centerX, z - centerZ)
  const cone = 1 - smoothstep(radius * .18, radius, distance)
  if (cone <= 0) return { uplift: 0, mask: 0, caldera: 0 }

  const shoulder = Math.pow(cone, 1.35)
  const caldera = 1 - smoothstep(radius * .04, radius * .19, distance)
  const height = 1900 + hash2(cx - 17, cz + 209) * 1700
  return {
    uplift: shoulder * height - caldera * height * .28,
    mask: smoothstep(0, .34, cone),
    caldera,
  }
}

/**
 * Continuous regional terrain built from broad, rounded landform families.
 * Green country stays smooth. Strong ledges and bowls are confined to dry,
 * alpine, or volcanic provinces where they read as intentional geology.
 */
export function sampleLandforms(x: number, z: number) {
  const wx = x + (fbm(x / 11000, z / 11000, 2) - .5) * 2200
  const wz = z + (fbm(x / 11000 + 51, z / 11000 - 39, 2) - .5) * 2200

  const moisture = clamp01((fbm(wx / 7200 + 30, wz / 7200 - 81, 2) - .2) * 1.7)
  const temperature = clamp01(
    (fbm(wx / 11000 - 65, wz / 11000 + 9, 2) - .2) * 1.65 +
      Math.sin(z / 45000) * .15,
  )
  const dry = 1 - smoothstep(.25, .5, moisture)
  const cold = 1 - smoothstep(.27, .47, temperature)
  const hot = smoothstep(.53, .75, temperature)

  const province = valueNoise(wx / 9000 + 215, wz / 9000 - 130)
  const mountainMacro = fbm(wx / 17000 - 123, wz / 17000 + 63, 2)
  const highlands = smoothstep(.5, .8, mountainMacro)
  const foothills = smoothstep(.34, .58, mountainMacro) * (1 - highlands)

  // A broad winding band inside each massif produces ranges instead of blobs.
  // The wide smoothstep keeps the ridges flyable and avoids needle peaks.
  const ridgeNoise = fbm(wx / 5200 + 81, wz / 5200 - 52, 2)
  const ridgeBand = 1 - Math.abs(ridgeNoise * 2 - 1)
  const ridge = smoothstep(.58, .94, ridgeBand) * highlands
  const ridgeSpine = Math.pow(Math.max(0, smoothstep(.58, .94, ridgeBand)), 1.9) * highlands
  const summit = .32 + fbm(wx / 4600 - 47, wz / 4600 + 116, 2) * .68
  const summitRefined = .22 + fbm(wx / 4600 - 47, wz / 4600 + 116, 2) * .78
  const summitFold = fbm(wx / 2600 + 173, wz / 2600 - 94, 2)
  // A second, tighter scale breaks the broad massif field into linked peaks.
  // Keep this as a signed, bounded sculpt rather than a raw high-frequency
  // height term so alpine faces gain shoulders and saddles without turning
  // into the sharp green-biome spikes this generator used to produce.
  const peakNoise = fbm(wx / 1850 + 293, wz / 1850 - 337, 3, 2, .56)
  const peakMask = smoothstep(.4, .78, peakNoise)
  const peakSculpt = (peakNoise - .5) * (.55 + ridgeSpine * .9)

  // Long winding troughs break mountain walls into recognizable valleys.
  const valleyLine = Math.abs(valueNoise(wx / 6800 + 141, wz / 6800 - 207) - .5)
  const alpineValley = (1 - smoothstep(.025, .15, valleyLine)) * highlands

  const hills = fbm(wx / 1700, wz / 1700, 2)
  const gentle = smoothstep(.18, .78, valueNoise(wx / 6500 + 5, wz / 6500 - 23))
  // Green provinces need visible topography at flight scale. Keep the same
  // smooth 1.7 km signal, but raise its broad amplitude so flat sheets are
  // uncommon while the existing curvature limits still suppress needles.
  const rolling = hills * hills * (92 + gentle * 390)
  const detail = (valueNoise(wx / 260, wz / 260) - .5) * 3
  const broadBase = 48 + valueNoise(wx / 7000, wz / 7000) * 120

  let height = broadBase + rolling + detail
  height += foothills * (180 + hills * hills * 720)
  const alpineExposure = Math.max(smoothstep(.92, 1, dry), smoothstep(.76, .96, cold))
  const mountainBlend = smoothstep(.35, .65, highlands) * alpineExposure
  const legacyUplift = highlands * (1050 + summit * 2100 + ridge * 4300)
  const refinedUplift = highlands * (650 + summitRefined * (2600 + summitFold * 850) + ridgeSpine * 2100)
  const mountainUplift = legacyUplift * (1 - mountainBlend) + refinedUplift * mountainBlend
  height += mountainUplift * (1 - alpineValley * (.68 + mountainBlend * .18))
  const alpineSculpt = highlands * alpineExposure * (
    peakSculpt * (450 + summitRefined * 900) +
    (peakMask - .5) * ridgeSpine * 520
  )
  height += alpineSculpt

  // Humid lowlands get rolling watersheds, never sharp vertical noise.
  const wet = smoothstep(.42, .76, moisture)
  height += wet * (1 - highlands) * hills * hills * (84 + hot * 50)
  // Cold provinces stay broad and flyable. Fine frozen noise was making
  // otherwise smooth tundra read as small spikes from the aircraft.
  height += cold * (valueNoise(wx / 900 + 33, wz / 900) - .3) * 14

  const badlandsBase = dry * smoothstep(.42, .65, province)
  const dunes = dry * (1 - smoothstep(.4, .62, province))
  const dunePhase = wx / 220 + Math.sin(wz / 1100) * 2 +
    valueNoise(wx / 1500, wz / 1500) * 6
  height += dunes * Math.pow((Math.sin(dunePhase) + 1) * .5, 2) * 48

  // Dry plateaus combine broad shelves with erosion terraces. Their harder
  // profile is deliberately excluded from green and wet biomes.
  const plateauField = valueNoise(wx / 12000 - 315, wz / 12000 + 171)
  const plateau = dry * (1 - highlands) * smoothstep(.57, .82, plateauField)
  const table = fbm(wx / 2300 + 81, wz / 2300 - 7, 2)
  const terraces = smoothstep(.24, .46, table) * 190 +
    smoothstep(.46, .7, table) * 310
  height += badlandsBase * terraces + plateau * (260 + terraces * .75)
  // Dry mesas use broad stepped shelves rather than a single smooth dune.
  // The transition is softened across each band so the terrain remains
  // flyable, while the deterministic ledges still read as cliffs and benches
  // at flight scale. This signal is gated to badlands and plateaus only.
  const shelfPhase = table * 4
  const shelfIndex = Math.floor(shelfPhase)
  const shelfBlend = smoothstep(.35, .98, shelfPhase - shelfIndex)
  const shelfShape = Math.min(1, shelfIndex / 3 + shelfBlend / 3)
  const shelfRelief = Math.max(0, shelfShape - table * .72)
  height += badlandsBase * shelfRelief * 180 + plateau * shelfRelief * 100

  const badlands = Math.max(badlandsBase, plateau * .82)

  const ravineLine = Math.abs(valueNoise(wx / 3800 - 10, wz / 3800 + 80) - .5)
  const ravine = Math.max(badlands, plateau * .7) *
    (1 - smoothstep(.025, .13, ravineLine))
  height -= ravine * (110 + plateau * 90)

  const landmark = volcanicLandmark(x, z)
  const volcanicProvince = smoothstep(.8, .95, province) *
    smoothstep(.35, .65, highlands)
  const volcanic = Math.max(volcanicProvince, landmark.mask)
  height += volcanicProvince * hills * hills * 760 + landmark.uplift

  const salt = dry * (1 - highlands) * (1 - smoothstep(.06, .15, province)) *
    (1 - landmark.mask)
  height += (90 + detail * .1 - height) * salt

  return {
    height,
    moisture,
    temperature,
    highlands,
    foothills,
    ridge,
    alpineValley,
    plateau,
    badlands,
    dunes,
    cold,
    hot,
    dry,
    ravine,
    volcanic,
    caldera: landmark.caldera,
    salt,
  }
}
