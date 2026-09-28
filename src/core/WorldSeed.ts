export interface ClipboardWriter {
  writeText(text: string): Promise<void>
}

const WORLD_SEED_DECIMAL_PLACES = 6
const WORLD_SEED_SCALE = 10 ** WORLD_SEED_DECIMAL_PLACES
const WORLD_SEED_INPUT_PATTERN = /^[+-]?(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/

/** Match the integer mix used by the terrain hash without exposing float noise. */
function canonicalWorldSeed(seed: number): number | null {
  if (!Number.isFinite(seed)) return null
  const scaled = Math.round(seed * WORLD_SEED_SCALE)
  if (!Number.isSafeInteger(scaled)) return null
  return scaled / WORLD_SEED_SCALE
}

/** Normalize a runtime seed before handing it back to the launch controls. */
export function normalizeWorldSeed(seed: number): number | null {
  return canonicalWorldSeed(seed)
}

export function formatWorldSeed(seed: number): string {
  const canonical = canonicalWorldSeed(seed)
  if (canonical === null) return '0'
  return canonical.toFixed(WORLD_SEED_DECIMAL_PLACES).replace(/\.?0+$/, '')
}

/** Keep launch controls honest when a requested world needs another rebuild attempt. */
export function worldSeedLaunchStatus(seed: number, rebuildFallback = false): string {
  const label = formatWorldSeed(seed)
  return rebuildFallback
    ? `SEED ${label} NOT READY · PRESS PLAY TO RETRY`
    : `SEED ${label} READY · PRESS PLAY`
}

/** Parse a bounded decimal seed without accepting exponent or lossy input. */
export function parseWorldSeed(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!WORLD_SEED_INPUT_PATTERN.test(normalized)) return null
  const parsed = Number(normalized)
  return canonicalWorldSeed(parsed)
}

/** A pending replay/custom seed must rebuild the world even when the course is random. */
export function shouldRegenerateWorldOnLaunch(courseId: unknown, replaySeed: number | null): boolean {
  return replaySeed !== null || courseId !== 'random'
}

/** Build a replay URL while preserving the current app route and diagnostics. */
export function worldSeedReplayUrl(
  href: string,
  seed: number,
  courseId?: string,
  dayKey?: string,
): string | null {
  const canonical = canonicalWorldSeed(seed)
  if (typeof href !== 'string' || href.trim() === '' || canonical === null) return null
  try {
    const url = new URL(href)
    url.searchParams.set('seed', formatWorldSeed(canonical))
    if (typeof courseId === 'string' && /^[a-z0-9-]{1,32}$/.test(courseId) && courseId !== 'random') {
      url.searchParams.set('course', courseId)
    } else {
      url.searchParams.delete('course')
    }
    // Rotating Ops courses are the only entries whose route/weather changes
    // with time. Keep their period key exact without adding state to other
    // authored or procedural worlds.
    if (courseId === 'daily-ops' && isDailyDayKey(dayKey)) {
      url.searchParams.set('day', dayKey)
      url.searchParams.delete('week')
    } else if (courseId === 'weekly-ops' && isWeeklyWeekKey(dayKey)) {
      url.searchParams.set('week', dayKey)
      url.searchParams.delete('day')
    } else {
      url.searchParams.delete('day')
      url.searchParams.delete('week')
    }
    return url.toString()
  } catch {
    return null
  }
}

function isDailyDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T12:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isWeeklyWeekKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-W\d{2}$/.test(value)) return false
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const week = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return false
  const janFourth = Date.UTC(year, 0, 4)
  const janFourthDay = new Date(janFourth).getUTCDay() || 7
  const monday = janFourth - (janFourthDay - 1) * 86_400_000 + (week - 1) * 604_800_000
  const timestamp = monday + 12 * 60 * 60 * 1000
  return Number.isFinite(timestamp) && isoWeekKey(timestamp) === value
}

function isoWeekKey(timestamp: number): string {
  const date = new Date(timestamp)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const yearStart = Date.UTC(year, 0, 1)
  const week = Math.ceil((((date.getTime() - yearStart) / 86_400_000) + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Copy a finite procedural seed without allowing clipboard failures to escape. */
export async function copyWorldSeed(
  seed: number,
  clipboard: ClipboardWriter | null | undefined,
): Promise<boolean> {
  const canonical = canonicalWorldSeed(seed)
  if (canonical === null || !clipboard || typeof clipboard.writeText !== 'function') return false
  try {
    await clipboard.writeText(formatWorldSeed(canonical))
    return true
  } catch {
    return false
  }
}

/** Copy a replay URL without allowing URL or clipboard failures to escape. */
export async function copyWorldSeedLink(
  seed: number,
  clipboard: ClipboardWriter | null | undefined,
  href: string,
  courseId?: string,
  dayKey?: string,
): Promise<boolean> {
  const link = worldSeedReplayUrl(href, seed, courseId, dayKey)
  if (!link || !clipboard || typeof clipboard.writeText !== 'function') return false
  try {
    await clipboard.writeText(link)
    return true
  } catch {
    return false
  }
}
