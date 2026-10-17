import { writeWeatherTransport } from '../src/world/WeatherTransport'
import { describe, expect, it } from 'vitest'
import { CloudCells, cloudCellLayer, shapeCloudFormation, type CloudLayer } from '../src/world/CloudFormations'

const layers: CloudLayer[] = [...Array<CloudLayer>(20).fill('cumulus'),
  ...Array<CloudLayer>(16).fill('stratus'), ...Array<CloudLayer>(10).fill('cirrus')]
function identities(field: CloudCells): string[] {
  return Array.from(field.cellX, (x, i) => `${x}:${field.cellZ[i]}:${field.layers[i]}`).sort()
}
function adoptAll(field: CloudCells): void {
  for (let i = 0; i < layers.length; i++) if (field.hasTarget(i)) field.adopt(i)
}

describe('world-cell cloud formations', () => {
  it('returns the same cells after travelling away and back, independent of pool ordering', () => {
    const field = new CloudCells(layers), fresh = new CloudCells([...layers].reverse())
    field.select(73, 1000, -2000, 180); adoptAll(field)
    const before = identities(field)
    field.select(73, 800000, -300000, 180); adoptAll(field)
    field.select(73, 1000, -2000, 180); adoptAll(field)
    fresh.select(73, 1000, -2000, 180); adoptAll(fresh)
    expect(identities(field)).toEqual(before)
    expect(identities(fresh)).toEqual(before)
    expect(new Set(before).size).toBe(46)
  })

  it('retains selected identities and does not mutate visible cells before adoption', () => {
    const field = new CloudCells(layers)
    field.select(42, 0, 0, 90); adoptAll(field)
    const before = identities(field)
    field.select(42, 8000, 0, 90)
    expect(identities(field)).toEqual(before)
    let retained = 0, retiring = 0
    for (let i = 0; i < 46; i++) {
      if (field.moving(i)) retiring++; else retained++
      expect(cloudCellLayer(42, field.targetX[i]!, field.targetZ[i]!)).toBe(layers[i])
    }
    expect(retained).toBeGreaterThan(30)
    expect(retiring).toBeGreaterThan(0)
    expect(field.cellX.length).toBe(46)
  })

  it('uses simulation-time advection with bounded buffers across a long trip', () => {
    const field = new CloudCells(layers), stationary = new CloudCells(layers)
    const xBuffer = field.cellX, targetBuffer = field.targetX
    const transport = writeWeatherTransport({ x: 0, z: 0 }, 1)
    field.select(1, transport.x * 1000, transport.z * 1000, 1000); adoptAll(field)
    stationary.select(1, 0, 0, 0); adoptAll(stationary)
    expect(identities(field)).toEqual(identities(stationary))
    for (let i = 0; i < 1000; i++) { field.select(1, i * 5000, -i * 1000, i); adoptAll(field) }
    expect(field.cellX).toBe(xBuffer); expect(field.targetX).toBe(targetBuffer)
    expect(() => new CloudCells(Array<CloudLayer>(47).fill('cumulus'))).toThrow()
  })

  it('fills existing layouts reproducibly with distinct sheet, crown and wisp shapes', () => {
    const puffs = Array.from({ length: 16 }, () => ({ x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, rotationY: 0 }))
    const objects = [...puffs]
    shapeCloudFormation(puffs, 'cumulus', 1, -3, 4)
    const crown = structuredClone(puffs)
    shapeCloudFormation(puffs, 'stratus', 1, -3, 4)
    const sheet = structuredClone(puffs)
    shapeCloudFormation(puffs, 'cirrus', 1, -3, 4)
    expect(puffs.every(p => p.sy / p.sx < .2)).toBe(true)
    expect(Math.max(...crown.map(p => p.y))).toBeGreaterThan(Math.max(...sheet.map(p => p.y)) * 2)
    shapeCloudFormation(puffs, 'cumulus', 1, -3, 4)
    expect(puffs).toEqual(crown)
    puffs.forEach((p, i) => expect(p).toBe(objects[i]))
    shapeCloudFormation(puffs, 'cumulus', 1, -2, 4)
    expect(puffs).not.toEqual(crown)
  })
})
