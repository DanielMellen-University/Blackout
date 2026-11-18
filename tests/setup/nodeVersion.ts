import { readFileSync } from 'node:fs'
import { nodeVersionNotice } from '../helpers/nodeVersion'

/** Vitest global setup: warn once per run when the local Node major differs from .nvmrc. */
export default function setup(): void {
  let pinned = ''
  try {
    pinned = readFileSync(new URL('../../.nvmrc', import.meta.url), 'utf8')
  } catch {
    return
  }
  const notice = nodeVersionNotice(process.version, pinned)
  if (notice) process.stderr.write(`\n${notice}\n\n`)
}
