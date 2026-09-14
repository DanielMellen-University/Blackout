export interface ClipboardWriter {
  writeText(text: string): Promise<void>
}

export function formatWorldSeed(seed: number): string {
  return Number.isFinite(seed) ? String(Math.trunc(seed)) : '0'
}

/** Parse the integer seed carried by a replay URL without accepting lossy input. */
export function parseWorldSeed(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!/^[+-]?\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/** Build a replay URL while preserving the current app route and diagnostics. */
export function worldSeedReplayUrl(href: string, seed: number): string | null {
  if (typeof href !== 'string' || href.trim() === '' || !Number.isFinite(seed)) return null
  try {
    const url = new URL(href)
    url.searchParams.set('seed', formatWorldSeed(seed))
    return url.toString()
  } catch {
    return null
  }
}

/** Copy a finite procedural seed without allowing clipboard failures to escape. */
export async function copyWorldSeed(
  seed: number,
  clipboard: ClipboardWriter | null | undefined,
): Promise<boolean> {
  if (!Number.isFinite(seed) || !clipboard || typeof clipboard.writeText !== 'function') return false
  try {
    await clipboard.writeText(formatWorldSeed(seed))
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
): Promise<boolean> {
  const link = worldSeedReplayUrl(href, seed)
  if (!link || !clipboard || typeof clipboard.writeText !== 'function') return false
  try {
    await clipboard.writeText(link)
    return true
  } catch {
    return false
  }
}
