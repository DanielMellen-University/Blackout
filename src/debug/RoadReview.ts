import type { SettlementRoad } from '../world/SettlementPlan'
import { MAX_ROAD_PROFILE_POINTS } from '../world/RoadSurface'

export interface RoadReviewPose { x: number; y: number; z: number; yaw: number }

/** One actually streamed profile, retained only for an opt-in developer trace. */
export class RoadReviewPath {
  private readonly distances: Float64Array
  readonly length: number
  private readonly road: SettlementRoad

  constructor(road: SettlementRoad) {
    this.road = road
    if (road.points.length < 2 || road.points.length > MAX_ROAD_PROFILE_POINTS) throw new Error('Invalid road review profile')
    this.distances = new Float64Array(road.points.length)
    for (let i = 0; i < road.points.length; i++) {
      const point = road.points[i]!
      if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('Invalid road review point')
      if (i) {
        const previous = road.points[i - 1]!
        this.distances[i] = this.distances[i - 1]! + Math.hypot(point.x - previous.x, point.z - previous.z)
      }
    }
    this.length = this.distances.at(-1)!
    if (!Number.isFinite(this.length) || this.length <= 0) throw new Error('Empty road review path')
  }

  sampleInto(out: RoadReviewPose, distance: number, clearance: number,
    ground: (x: number, z: number) => number): void {
    const along = Math.max(0, Math.min(this.length, Number.isFinite(distance) ? distance : 0))
    let low = 1, high = this.distances.length - 1
    while (low < high) {
      const mid = (low + high) >>> 1
      if (this.distances[mid]! <= along) low = mid + 1
      else high = mid
    }
    // Zero-length points carry no travel time. Walk backwards only at the end.
    let index = low
    while (index > 1 && this.distances[index] === this.distances[index - 1]) index--
    const a = this.road.points[index - 1]!, b = this.road.points[index]!
    const span = this.distances[index]! - this.distances[index - 1]!
    const t = span > 0 ? Math.min(1, (along - this.distances[index - 1]!) / span) : 0
    out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t
    out.y = Math.max(a.y + (b.y - a.y) * t, ground(out.x, out.z)) +
      Math.max(30, Math.min(500, Number.isFinite(clearance) ? clearance : 90))
    out.yaw = Math.atan2(b.x - a.x, b.z - a.z)
  }
}
