/**
 * Agent-only debug. Players never see this unless the URL is opened with
 * ?debug=1 (or localStorage blackoutDebug=1).
 */
export function isDebugEnabled(): boolean {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('debug') === '1' || q.get('debug') === 'true') return true
    if (window.localStorage.getItem('blackoutDebug') === '1') return true
  } catch {
    /* ignore */
  }
  return false
}
