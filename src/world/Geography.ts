import { smoothstep } from './noise'
import { sampleLandformsInto, type LandformSample } from './Landforms'
import { sampleHydrologyInto, type HydrologySample } from './Hydrology'
import type { Biome, Climate } from './terrainSample'

// Geography is sampled for every terrain vertex. Reuse this short-lived
// hydrology record instead of allocating one object per vertex.
const hydrologyScratch: HydrologySample = {
  height: 0, waterLevel: 0, river: 0, lake: 0, pond: 0, stream: 0, coastal: 0,
}
const landformScratch: LandformSample = {
  height: 0, moisture: 0, temperature: 0, highlands: 0, foothills: 0,
  ridge: 0, alpineValley: 0, plateau: 0, badlands: 0, dunes: 0,
  alluvial: 0, karst: 0, glacial: 0, cold: 0, hot: 0, dry: 0,
  ravine: 0, volcanic: 0, caldera: 0, salt: 0,
}

const BIOME_ORDER: readonly Biome[] = [
  'plains', 'hills', 'forest', 'rainforest', 'swamp', 'desert', 'mesa',
  'savanna', 'tundra', 'mountain', 'snow', 'volcanic', 'saltflat',
]

type BufferedClimate = Climate & { _biomeWeightsStorage: [Biome, number][] }

export interface GeographySurfaceSample {
  height: number
  bedHeight: number
  waterLevel: number
}

/** Create a reusable climate record for high-frequency terrain sampling. */
export function createClimateSample(): Climate {
  const biomeWeights = BIOME_ORDER.map((biome): [Biome, number] => [biome, 0])
  const record = {
    height: 0, waterLevel: 0, moisture: 0, temperature: 0,
    biome: 'plains', biomeB: 'plains', biomeMix: 0, biomeWeights,
    river: 0, land: 1, coastal: 0,
    features: { river: 0, lake: 0, ravine: 0, pond: 0, stream: 0 },
    landform: {
      ridge: 0, alpineValley: 0, plateau: 0, caldera: 0, foothills: 0,
      dunes: 0, alluvial: 0, badlands: 0, karst: 0, glacial: 0,
    },
  } as Climate
  Object.defineProperty(record, '_biomeWeightsStorage', {
    value: biomeWeights, writable: true, configurable: true,
  })
  return record
}

/** Landform and drainage fields meet here; water rendering is independent. */
export function sampleGeography(x: number, z: number): Climate {
  return sampleGeographyInto(createClimateSample(), x, z)
}

/** Write geography into caller-owned storage to avoid nested allocations per vertex. */
export function sampleGeographyInto(out: Climate, x: number, z: number): Climate {
  const buffered = out as BufferedClimate
  if (!buffered._biomeWeightsStorage) {
    Object.defineProperty(buffered, '_biomeWeightsStorage', {
      value: out.biomeWeights ?? BIOME_ORDER.map((biome): [Biome, number] => [biome, 0]),
      writable: true, configurable: true,
    })
  }
  const landform = sampleLandformsInto(landformScratch, x, z)
  const hydrology = sampleHydrologyInto(hydrologyScratch, x, z, landform.height, landform.coast)
  const { height, waterLevel, river, lake, pond, stream, coastal } = hydrology
  const { moisture, temperature, cold, hot, dunes, badlands, karst, volcanic, salt } = landform
  const alpine = smoothstep(650, 1900, height)
  const snow = smoothstep(2600 - cold * 1100 + hot * 700, 3600 - cold * 900 + hot * 700, height)
  const low = 1 - alpine
  const biomeWeights = buffered._biomeWeightsStorage
  biomeWeights[0]![1] = .65 * low * (1 - cold * .8)
  biomeWeights[1]![1] = smoothstep(200, 450, height) * low * .65
  biomeWeights[2]![1] = smoothstep(.35, .66, moisture) * low * (1 - hot * .55)
  biomeWeights[3]![1] = smoothstep(.48, .76, moisture) * hot * low * 1.8
  biomeWeights[4]![1] = smoothstep(.55, .8, moisture) * Math.max(lake, pond, river, coastal) * low * 3.2
  biomeWeights[5]![1] = dunes * low * 2
  biomeWeights[6]![1] = badlands * (1 - alpine * .85) * 2
  biomeWeights[7]![1] = hot * (1 - smoothstep(.3, .58, moisture)) * low * 1.4
  biomeWeights[8]![1] = cold * low * 1.5
  biomeWeights[9]![1] = alpine * (1 - snow) * 2
  biomeWeights[10]![1] = snow * 3
  biomeWeights[11]![1] = volcanic * 4
  biomeWeights[12]![1] = salt * 4
  let biome: Biome = 'plains', biomeB: Biome = 'plains', best = 0, second = 0
  for (const [candidate, weight] of biomeWeights) {
    if (weight > best) { second = best; biomeB = biome; best = weight; biome = candidate }
    else if (weight > second) { second = weight; biomeB = candidate }
  }
  if (height < waterLevel) biome = biomeB = waterLevel <= 0 ? 'ocean' : 'water'
  out.height = height
  out.waterLevel = waterLevel
  out.moisture = moisture
  out.temperature = temperature
  out.biome = biome
  out.biomeB = biomeB
  out.biomeMix = second / Math.max(.00001, best + second)
  out.biomeWeights = biomeWeights
  out.land = height < waterLevel ? .2 : 1 - coastal * .35
  out.river = river
  out.coastal = coastal
  out.features.river = river
  out.features.lake = lake
  out.features.ravine = landform.ravine
  out.features.pond = pond
  out.features.stream = stream
  out.landform.ridge = landform.ridge
  out.landform.alpineValley = landform.alpineValley
  out.landform.plateau = landform.plateau
  out.landform.caldera = landform.caldera
  out.landform.foothills = landform.foothills
  out.landform.dunes = landform.dunes
  out.landform.alluvial = landform.alluvial
  out.landform.badlands = landform.badlands
  out.landform.karst = karst
  out.landform.glacial = landform.glacial
  return out
}

/** Height-only geography path for terrain normal probes that need no climate object. */
export function sampleGeographyHeight(x: number, z: number): number {
  const landform = sampleLandformsInto(landformScratch, x, z)
  return sampleHydrologyInto(hydrologyScratch, x, z, landform.height, landform.coast).height
}

/**
 * Scalar resolved surface probe for contact and AGL hot paths. This keeps the
 * hydrology water level without constructing biome weights or a Climate
 * object, so fallback ground queries stay allocation-free like the worker
 * height probe.
 */
export function sampleGeographySurfaceHeight(x: number, z: number): number {
  return sampleGeographySurfaceInto(surfaceScratch, x, z).height
}

const surfaceScratch: GeographySurfaceSample = { height: 0, bedHeight: 0, waterLevel: 0 }

/** Fill the resolved scalar surface without allocating a Climate record. */
export function sampleGeographySurfaceInto(
  out: GeographySurfaceSample,
  x: number,
  z: number,
): GeographySurfaceSample {
  const landform = sampleLandformsInto(landformScratch, x, z)
  const hydrology = sampleHydrologyInto(hydrologyScratch, x, z, landform.height, landform.coast)
  out.bedHeight = hydrology.height
  out.waterLevel = hydrology.waterLevel
  out.height = Math.max(hydrology.height, hydrology.waterLevel)
  return out
}
