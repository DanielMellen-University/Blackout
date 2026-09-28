/** Keep pinned launch courses bounded and safe for optional storage. */
export const COURSE_FAVORITES_STORAGE_KEY = 'blackout.course-favorites'
export const COURSE_FAVORITES_LIMIT = 32

export function toggleCourseFavorite(
  favoriteIds: readonly string[],
  courseId: string,
  favorite: boolean,
  limit = COURSE_FAVORITES_LIMIT,
): string[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(64, Math.floor(limit))) : COURSE_FAVORITES_LIMIT
  const normalizedId = normalizeCourseId(courseId)
  const next: string[] = []
  for (const id of favoriteIds) {
    const normalized = normalizeCourseId(id)
    if (!normalized || normalized === normalizedId || next.includes(normalized)) continue
    next.push(normalized)
    if (next.length >= safeLimit) break
  }
  if (favorite && normalizedId) {
    next.unshift(normalizedId)
    return next.slice(0, safeLimit)
  }
  return next
}

export function readCourseFavoriteIds(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  limit = COURSE_FAVORITES_LIMIT,
): string[] {
  try {
    const raw = storage?.getItem(COURSE_FAVORITES_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return toggleCourseFavorite(parsed.map(value => typeof value === 'string' ? value : ''), '', false, limit)
  } catch {
    return []
  }
}

export function writeCourseFavoriteIds(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  favoriteIds: readonly string[],
  limit = COURSE_FAVORITES_LIMIT,
): void {
  try {
    storage?.setItem(COURSE_FAVORITES_STORAGE_KEY, JSON.stringify(
      toggleCourseFavorite(favoriteIds, '', false, limit),
    ))
  } catch {
    /* Storage is optional and can be denied in private browsing. */
  }
}

function normalizeCourseId(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9-]{1,48}$/.test(normalized) ? normalized : ''
}
