import { afterEach, describe, expect, it } from 'vitest'
import { waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'

afterEach(() => setWorldSeed(1337.9182))
const ids = () => waterLandmarks(0, 0).map(b => `${b.id ?? 'sea'}:${b.x.toFixed(2)}:${b.z.toFixed(2)}`)

describe('hydrology cache across reseeds', () => {
  it('drops the old seed cache and replays the original lakes on return', () => {
    setWorldSeed(73)
    const first = ids()
    setWorldSeed(1)
    const other = ids()
    setWorldSeed(73)
    expect(ids()).toEqual(first)
    expect(other).not.toEqual(first)
  }, 60000)
})
