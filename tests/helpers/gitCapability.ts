/** Only skip missing/denied subprocess capabilities, never a Git command failure. */
export function unavailableGitReason(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const code = error.code
  return typeof code === 'string' && ['ENOENT', 'EACCES', 'EPERM', 'EROFS'].includes(code)
    ? `Git archive reads unavailable (${code}); frozen-runtime evidence checks require Git subprocess access.`
    : null
}
