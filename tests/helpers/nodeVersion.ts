/**
 * Explain why hydrology snapshot hashes may fail when the suite runs on a
 * Node major other than the pinned one. Returns null when the versions match
 * or the pin cannot be read.
 */
export function nodeVersionNotice(runningVersion: string, pinned: string): string | null {
  const running = /^v?(\d+)\./.exec(runningVersion.trim())?.[1]
  const wanted = /^v?(\d+)(?:\.|$)/.exec(pinned.trim())?.[1]
  if (!running || !wanted || running === wanted) return null
  return `Running tests on Node ${running}, but .nvmrc pins Node ${wanted}. ` +
    'Some hydrology snapshot hashes depend on Node math rounding and can fail here while CI passes. ' +
    `Switch with \`nvm use\` or \`fnm use\` before trusting those failures.`
}
