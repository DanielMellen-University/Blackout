import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

class CommandError extends Error {}

function readReplay(path, maxBytes) {
  let fd
  try {
    // Nonblocking open lets us reject FIFOs rather than wait for a writer.
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK)
    const stat = fstatSync(fd)
    if (!stat.isFile()) throw new Error('expected a regular file')
    if (stat.size > maxBytes) throw new Error('too-large at $')
    const chunks = []
    let length = 0
    for (;;) {
      // Read at most one byte beyond the budget, even if the file grows after stat.
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maxBytes - length + 1))
      const count = readSync(fd, chunk, 0, chunk.length, null)
      if (count === 0) break
      length += count
      if (length > maxBytes) throw new Error('too-large at $')
      chunks.push(chunk.subarray(0, count))
    }
    return Buffer.concat(chunks, length).toString('utf8')
  } catch (error) {
    throw new CommandError(`Cannot read replay ${JSON.stringify(path)}: ${error.code ?? error.message}`)
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

const args = process.argv.slice(2)
let loader
try {
  if (args.length !== 1) {
    throw new CommandError(`usage: npm run verify:operation -- <file>\nExpected exactly one replay file; received ${args.length} arguments.\nExit codes: 0 match, 1 mismatch, 2 unreadable or invalid.`)
  }
  // Load the same TypeScript scorer as the browser, without opening a listening port.
  loader = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
  })
  const { verifyOperationReplayFile } = await loader.ssrLoadModule('/src/systems/operation/replayVerification.ts')
  const { OPERATION_REPLAY_MAX_BYTES } = await loader.ssrLoadModule('/src/systems/operation/replayFile.ts')
  const text = readReplay(args[0], OPERATION_REPLAY_MAX_BYTES)
  const result = verifyOperationReplayFile(text)
  if (!result.ok) throw new Error(`${result.reason} at ${result.path} (${JSON.stringify(args[0])})`)
  const { summary } = result
  console.log(`${result.matches ? 'MATCH' : 'MISMATCH'} ridge-relay seed ${summary.seed}, ${summary.decisionPath.join(' then ')}: ${summary.score} (${summary.medal}), ${summary.elapsedSec.toFixed(3)} s, ${summary.phase}`)
  for (const stage of result.stages) {
    console.log(`${stage.id}: claimed ${stage.claimed}, actual ${stage.actual ?? 'not reached'}, difference ${stage.difference ?? 'not reached'}`)
  }
  console.log(`Total: claimed ${result.claimedTotal}, actual ${summary.score}, difference ${result.totalDifference}`)
  process.exitCode = result.matches ? 0 : 1
} catch (error) {
  console.error(error instanceof CommandError ? error.message : `Invalid replay: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
} finally {
  if (loader) await loader.close()
}
