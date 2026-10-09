/** Escape dismisses a styled native picker before the game's pause shortcut. */
export function nativeSelectOwnsEscape(event: Pick<KeyboardEvent, 'code' | 'target'>): boolean {
  if (event.code !== 'Escape' || !(event.target instanceof Element)) return false
  const select = event.target.closest('select')
  if (!select) return false
  try {
    return select.matches(':open')
  } catch {
    // Older browsers without :open retain their ordinary native select handling.
    return false
  }
}
