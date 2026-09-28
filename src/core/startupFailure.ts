/** Keep boot failures actionable without exposing raw browser internals. */
export function startupFailureMessage(error: unknown): string {
  const raw = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error)
  const detail = raw.toLowerCase()

  if (detail.includes('webgl') || detail.includes('renderer') || detail.includes('gpu')) {
    return 'Graphics unavailable. Enable hardware acceleration or try another browser.'
  }
  if (
    detail.includes('world') ||
    detail.includes('terrain') ||
    detail.includes('spawn') ||
    detail.includes('reseed') ||
    detail.includes('inland pad')
  ) {
    return 'Could not create a world. Press Retry to try again.'
  }
  return 'Blackout could not start. Reload the page to try again.'
}

/** World search failures can safely retry with a fresh seeded attempt. */
export function startupFailureCanRetry(error: unknown): boolean {
  const raw = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error)
  const detail = raw.toLowerCase()
  if (detail.includes('webgl') || detail.includes('renderer') || detail.includes('gpu')) return false
  return detail.includes('world') ||
    detail.includes('terrain') ||
    detail.includes('spawn') ||
    detail.includes('reseed') ||
    detail.includes('inland pad')
}
