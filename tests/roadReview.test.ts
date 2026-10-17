import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { RoadReviewPath } from '../src/debug/RoadReview'
import { MAX_ROAD_PROFILE_POINTS } from '../src/world/RoadSurface'

it('follows the actual bent road by distance with forward body yaw and streamed ground clearance', () => {
  const path = new RoadReviewPath({ width: 10, points: [
    { x: 100, y: 20, z: -100 }, { x: 200, y: 30, z: -100 }, { x: 200, y: 50, z: 0 },
  ] })
  const pose = { x: 0, y: 0, z: 0, yaw: 0 }
  expect(path.length).toBe(200)
  path.sampleInto(pose, 50, 90, () => 22)
  expect(pose).toEqual({ x: 150, y: 115, z: -100, yaw: Math.PI / 2 })
  path.sampleInto(pose, 150, 90, () => 45)
  expect(pose).toEqual({ x: 200, y: 135, z: -50, yaw: 0 })
  path.sampleInto(pose, 1000, 90, () => 10)
  expect(pose).toEqual({ x: 200, y: 140, z: 0, yaw: 0 })
  path.sampleInto(pose, -20, NaN, () => 10)
  expect(pose).toEqual({ x: 100, y: 110, z: -100, yaw: Math.PI / 2 })
})

it('handles duplicate stations and bounds review-only storage and height', () => {
  const point = { x: 0, y: 20, z: 0 }, end = { x: 100, y: 20, z: 0 }
  const path = new RoadReviewPath({ width: 10, points: [point, point, end, end] })
  const pose = { x: 0, y: 0, z: 0, yaw: 0 }
  path.sampleInto(pose, 100, 10000, () => 20)
  expect(pose.x).toBe(100); expect(pose.y).toBe(520); expect(pose.yaw).toBe(Math.PI / 2)
  path.sampleInto(pose, NaN, -10, () => 20)
  expect(pose.x).toBe(0); expect(pose.y).toBe(50)
  for (const points of [[], [point, point], [point, { ...end, y: NaN }], Array(MAX_ROAD_PROFILE_POINTS + 1).fill(point)]) {
    expect(() => new RoadReviewPath({ width: 10, points })).toThrow()
  }
})

it('uses production camera modes and loaded profiles in the opt-in terrain review', () => {
  const source = readFileSync(new URL('../dev/terrain.html', import.meta.url), 'utf8')
  expect(source).toContain('world.settlements.nearestRoadReview(')
  expect(source).toContain("const mode=view==='first'?'cockpit':'chase'")
  expect(source).toContain('chase.setMode(mode,reviewJet)')
  expect(source).toContain('roadTrace.sampleInto(roadPose,roadDistance,')
  expect(source).toContain('sampleGroundHeight)')
  expect(source).toContain("document.querySelector('#road-tour').textContent='Road trace complete'")
})
