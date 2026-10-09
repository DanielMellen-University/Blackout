import type { CourseId } from '../systems/CourseLibrary'

export const FEATURED_MISSION_IDS = ['free-flight', 'training-orbit', 'daily-ops'] as const
export const HIDDEN_MISSION_IDS: readonly string[] = ['weekly-ops', 'monthly-ops']

/** Saved selections are repaired for browsing, never for explicit replay links. */
export function browsingMissionId(id: CourseId): CourseId {
  return HIDDEN_MISSION_IDS.includes(id) ? 'training-orbit' : id
}

/** Presentation only: actual Daily challenge generation still follows its existing UTC day. */
export function dailyChallengeCountdown(nowMs: number): string {
  if (!Number.isFinite(nowMs)) return '--:--:--'
  const day = 86_400_000
  const estOffset = 5 * 60 * 60 * 1000
  const nextMidnight = (Math.floor((nowMs - estOffset) / day) + 1) * day + estOffset
  const remaining = Math.ceil((nextMidnight - nowMs) / 1000)
  return [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
}

/** Move between the three featured columns and the independently sized mission grid. */
export function featuredMissionNavigationIndex(
  key: string, index: number, featured: number, grid: number, columns: number,
): number | null {
  const count = featured + grid
  if (!count) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  const inFeatured = index < featured
  const column = inFeatured ? index : (index - featured) % columns
  const rowStart = inFeatured ? 0 : index - column
  const rowSize = inFeatured ? featured : Math.min(columns, count - rowStart)
  if (key === 'ArrowLeft') return Math.max(rowStart, index - 1)
  if (key === 'ArrowRight') return Math.min(rowStart + rowSize - 1, index + 1)
  if (key === 'ArrowUp') {
    if (inFeatured) return index
    if (rowStart === featured) return Math.min(featured - 1, Math.floor((column + .5) / columns * featured))
    return index - columns
  }
  if (key === 'ArrowDown') {
    if (inFeatured) return grid ? featured + Math.min(grid - 1, Math.floor((column + .5) / featured * columns)) : index
    return rowStart + columns < count ? Math.min(count - 1, index + columns) : index
  }
  return null
}
