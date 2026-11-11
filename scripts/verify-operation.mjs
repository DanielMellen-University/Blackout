import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

class CommandError extends Error {}

function readReplay(path) {
  try {
    if (!statSync(path).isFile()) throw new Error('expected a regular file')
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new CommandError(`Cannot read replay ${JSON.stringify(path)}: ${error.code ?? error.message}`)
  }
}

const args = process.argv.slice(2)
let loader
try {
  if (args.length !== 1) {
    throw new CommandError(`usage: npm run verify:operation -- <file>\nExpected exactly one replay file; received ${args.length} arguments.\nExit codes: 0 match, 1 mismatch, 2 unreadable or invalid.`)
  }
  const text = readReplay(args[0])
  // Load the same TypeScript scorer as the browser, without opening a listening port.
  loader = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
  })
  const { verifyOperationReplayFile } = await loader.ssrLoadModule('/src/systems/operation/replayVerification.ts')
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
