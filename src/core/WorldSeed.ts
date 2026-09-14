export interface ClipboardWriter {
  writeText(text: string): Promise<void>
}

export function formatWorldSeed(seed: number): string {
  return Number.isFinite(seed) ? String(Math.trunc(seed)) : '0'
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
