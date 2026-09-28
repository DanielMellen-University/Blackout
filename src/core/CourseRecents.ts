/** Keep the launch catalog's recent list bounded and safe for optional storage. */
export const COURSE_RECENTS_STORAGE_KEY = 'blackout.course-recents'
export const COURSE_RECENTS_LIMIT = 8

export function rememberCourseId(
  recentIds: readonly string[],
  courseId: string,
  limit = COURSE_RECENTS_LIMIT,
): string[] {
  const safeId = normalizeCourseId(courseId)
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(32, Math.floor(limit))) : COURSE_RECENTS_LIMIT
  const next: string[] = safeId ? [safeId] : []
  for (const id of recentIds) {
    const normalized = normalizeCourseId(id)
    if (!normalized || normalized === safeId || next.includes(normalized)) continue
    next.push(normalized)
    if (next.length >= safeLimit) break
  }
  return next
}

export function readRecentCourseIds(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  limit = COURSE_RECENTS_LIMIT,
): string[] {
  try {
    const raw = storage?.getItem(COURSE_RECENTS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return rememberCourseId(parsed.map(value => typeof value === 'string' ? value : ''), '', limit)
  } catch {
    return []
  }
}

export function writeRecentCourseIds(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  recentIds: readonly string[],
  limit = COURSE_RECENTS_LIMIT,
): void {
  try {
    storage?.setItem(COURSE_RECENTS_STORAGE_KEY, JSON.stringify(
      rememberCourseId(recentIds, '', limit),
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
