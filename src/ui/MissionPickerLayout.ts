import type { CourseId } from '../systems/CourseLibrary'

/**
 * Flight Plan featured top row: exactly Free flight, Training orbit, Daily challenge.
 * LOCKED by Daniel Oct 28 2026: do not add/remove/rename/reorder featured cards unless Daniel explicitly asks.
 */
export const FEATURED_MISSION_IDS = ['free-flight', 'training-orbit', 'daily-ops'] as const
export const HIDDEN_MISSION_IDS: readonly string[] = ['weekly-ops', 'monthly-ops']

/** Saved selections are repaired for browsing, never for explicit replay links. */
export function browsingMissionId(id: CourseId): CourseId {
  return HIDDEN_MISSION_IDS.includes(id) ? 'training-orbit' : id
}

/** Count down to the UTC midnight the daily challenge actually resets at. */
export function dailyChallengeCountdown(nowMs: number): string {
  if (!Number.isFinite(nowMs)) return '--:--:--'
  const day = 86_400_000
  const nextMidnight = (Math.floor(nowMs / day) + 1) * day
  const remaining = Math.ceil((nextMidnight - nowMs) / 1000)
  return [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
}

/** Move between the featured row and the independently sized mission grid. */
export function featuredMissionNavigationIndex(
  key: string, index: number, featured: number, grid: number, columns: number,
): number | null {
  const safeFeatured = Number.isFinite(featured) ? Math.max(0, Math.floor(featured)) : 0
  const safeGrid = Number.isFinite(grid) ? Math.max(0, Math.floor(grid)) : 0
  const count = safeFeatured + safeGrid
  if (!count) return null
  const safeColumns = Number.isFinite(columns) && columns >= 1 ? Math.floor(columns) : 1
  const safeIndex = Number.isFinite(index)
    ? Math.min(count - 1, Math.max(0, Math.floor(index)))
    : 0
  const inFeatured = safeIndex < safeFeatured
  const column = inFeatured ? safeIndex : (safeIndex - safeFeatured) % safeColumns
  const rowStart = inFeatured ? 0 : safeIndex - column
  const rowSize = inFeatured ? safeFeatured : Math.min(safeColumns, count - rowStart)
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowLeft') return Math.max(rowStart, safeIndex - 1)
  if (key === 'ArrowRight') return Math.min(rowStart + rowSize - 1, safeIndex + 1)
  if (key === 'ArrowUp') {
    if (inFeatured) return safeIndex
    if (rowStart === safeFeatured) return Math.min(safeFeatured - 1, Math.floor((column + .5) / safeColumns * safeFeatured))
    return safeIndex - safeColumns
  }
  if (key === 'ArrowDown') {
    if (inFeatured) return safeGrid ? safeFeatured + Math.min(safeGrid - 1, Math.floor((column + .5) / safeFeatured * safeColumns)) : safeIndex
    return rowStart + safeColumns < count ? Math.min(count - 1, safeIndex + safeColumns) : safeIndex
  }
  return null
}
