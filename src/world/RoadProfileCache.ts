import type { RegionalRoadLink } from './RegionalRoads'
import type { SettlementRoad } from './SettlementPlan'
import { MAX_ROAD_PROFILE_POINTS } from './RoadSurface'

export const MAX_ROAD_PROFILE_CACHE_ENTRIES = 8
export const MAX_ROAD_PROFILE_CACHE_POINTS = MAX_ROAD_PROFILE_POINTS

/** Worker-only handoff cache: graph acceptance and subsequent road requests
 * share profiles without sending complete profiles in graph messages. Bound
 * both entries (including failures) and retained point count, not just roads. */
export class RoadProfileCache {
  private context = ''
  private readonly entries = new Map<string, SettlementRoad | null>()
  private points = 0

  setContext(context: string): void {
    if (context === this.context) return
    this.context = context; this.entries.clear(); this.points = 0
  }

  getOrBuild(link: RegionalRoadLink, build: () => SettlementRoad | null): SettlementRoad | null {
    // Include exact compact attachment/ownership fields, not only the edge ID.
    // A stale endpoint must never receive a cached profile for a different site.
    const key = JSON.stringify([link.from, link.to])
    const cached = this.entries.get(key)
    if (cached !== undefined) {
      this.entries.delete(key); this.entries.set(key, cached)
      return cached
    }
    const road = build(), count = road?.points.length ?? 0
    if (count > MAX_ROAD_PROFILE_CACHE_POINTS) return road
    while (this.entries.size >= MAX_ROAD_PROFILE_CACHE_ENTRIES || this.points + count > MAX_ROAD_PROFILE_CACHE_POINTS) {
      const oldest = this.entries.keys().next().value!
      this.points -= this.entries.get(oldest)?.points.length ?? 0
      this.entries.delete(oldest)
    }
    this.entries.set(key, road); this.points += count
    return road
  }
}
