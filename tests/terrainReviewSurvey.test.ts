import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerrainReviewSurvey } from '../scripts/lib/terrain-review-survey'
import { hydrologyPreparedAt, prepareHydrologyInBoundsSteps } from '../src/world/Hydrology'
import { sampleTerrainSurfaceHeightFast } from '../src/world/terrainSample'

vi.mock('../src/world/Hydrology', () => ({
  CATCHMENT_SIZE: 32000,
  hydrologyPreparedAt: vi.fn(() => false),
  prepareHydrologyInBoundsSteps: vi.fn(),
}))
vi.mock('../src/world/terrainSample', () => ({ sampleTerrainSurfaceHeightFast: vi.fn((x: number, z: number) => x * .01 + z * .02) }))
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks() })
const distances = [0, 500, 1000, 1800, 3000, 4500, 6000, 8000]

describe('review pilot cold look-ahead', () => {
  it('defers the entire exact survey and shares one slice across fixed steps', () => {
    let ready = false, clock = 0
    vi.mocked(hydrologyPreparedAt).mockImplementation(x => x < 64000 || ready)
    const prepare = vi.mocked(prepareHydrologyInBoundsSteps)
    prepare.mockImplementation(function* () { for (let i = 0; i < 6; i++) yield 'routing'; ready = true })
    vi.spyOn(performance, 'now').mockImplementation(() => clock += 2)
    const survey = new TerrainReviewSurvey()
    for (let i = 0; i < 20; i++) expect(survey.sample(56063, 34982, Math.PI / 2, 650, distances)).toBeNull()
    expect(prepare).toHaveBeenCalledExactlyOnceWith(64063, 34982, 64063, 34982)
    expect(sampleTerrainSurfaceHeightFast).not.toHaveBeenCalled()
    for (let i = 0; i < 6; i++) {
      survey.advance()
      expect(survey.sample(56063, 34982, Math.PI / 2, 650, distances)).toBeNull()
    }
    survey.advance()
    const target = survey.sample(56063, 34982, Math.PI / 2, 650, distances)
    expect(target).toBe(Math.max(...distances.map(d => (56063 + d) * .01 + 34982 * .02 + 650 - d * .025)))
    expect(sampleTerrainSurfaceHeightFast).toHaveBeenCalledTimes(8)
    expect(survey.slices).toBe(7)
    expect(prepare).toHaveBeenCalledTimes(1)
    survey.reset()
  })

  it('cancels partial drainage on restart and when the query leaves a catchment', () => {
    vi.mocked(hydrologyPreparedAt).mockReturnValue(false)
    const cancelled = vi.fn()
    vi.mocked(prepareHydrologyInBoundsSteps).mockImplementation(function* () { try { while (true) yield 'routing' } finally { cancelled() } })
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock += 2)
    const survey = new TerrainReviewSurvey()
    survey.sample(64063, 34982, 0, 650, [0]); survey.advance()
    survey.sample(96063, 34982, 0, 650, [0])
    expect(cancelled).toHaveBeenCalledTimes(1)
    survey.advance(); survey.reset()
    expect(cancelled).toHaveBeenCalledTimes(2)
    expect(survey.slices).toBe(0)
    expect(sampleTerrainSurfaceHeightFast).not.toHaveBeenCalled()
  })

  it('allocates no preparation iterator for a warm survey', () => {
    vi.mocked(hydrologyPreparedAt).mockReturnValue(true)
    const survey = new TerrainReviewSurvey()
    for (let i = 0; i < 10; i++) expect(survey.sample(56063, 34982, Math.PI / 2, 650, distances)).toBeTypeOf('number')
    expect(prepareHydrologyInBoundsSteps).not.toHaveBeenCalled()
    expect(survey.deferred).toBe(0)
  })
})
