import { createHash } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { TerrainReviewSurvey } from '../scripts/lib/terrain-review-survey'
import { hydrologyPreparedAt, prepareHydrologyInBoundsSteps, riverReaches, waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { clearOpsPad, sampleTerrainSurfaceHeightFast } from '../src/world/terrainSample'

const distances = [0, 500, 1000, 1800, 3000, 4500, 6000, 8000]
function reset() {
  clearOpsPad(); setTerrainProfile(null); setWorldSeed(1338)
  const steps = prepareHydrologyInBoundsSteps(56063, 34982, 56063, 34982)
  steps.next(); steps.return(); setWorldSeed(1337)
}
afterEach(() => { clearOpsPad(); setTerrainProfile(null) })

it('prepares the actual b19 cold (2,1) catchment without changing analytic samples or drainage', () => {
  reset()
  const direct = distances.map(d => sampleTerrainSurfaceHeightFast(56063 + d, 34982))
  const digest = () => createHash('sha256').update(JSON.stringify({ basins: waterLandmarks(2, 1), reaches: riverReaches(2, 1) })).digest('hex')
  const expected = digest()
  expect(expected).toBe('51c372ada6a541c26b31e70cd5fecd958d34381a3b8acbba85a403d567df2790')
  reset()
  expect(hydrologyPreparedAt(64063, 34982)).toBe(false)
  const survey = new TerrainReviewSurvey()
  expect(survey.sample(56063, 34982, Math.PI / 2, 650, distances)).toBeNull()
  expect(hydrologyPreparedAt(64063, 34982)).toBe(false)
  let target: number | null = null, frames = 0
  while (target === null && frames++ < 10000) {
    survey.advance()
    target = survey.sample(56063, 34982, Math.PI / 2, 650, distances)
  }
  expect(frames).toBeLessThan(10000)
  expect(target).toBe(Math.max(...direct.map((h, i) => h + 650 - distances[i]! * .025)))
  expect(distances.map(d => sampleTerrainSurfaceHeightFast(56063 + d, 34982))).toEqual(direct)
  expect(digest()).toBe(expected)
  survey.reset()
})
