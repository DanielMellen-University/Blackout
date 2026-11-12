import { spawn } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { replayFileTranscript, serializeOperationReplayFile } from '../src/systems/operation/replayFile'

const script = fileURLToPath(new URL('../scripts/verify-operation.mjs', import.meta.url))
const fixturePath = fileURLToPath(new URL('../docs/reviews/operation-11.040/seed-42-valley-commit.replay.json', import.meta.url))
const fixtureText = readFileSync(fixturePath, 'utf8')
const fixture = JSON.parse(fixtureText)
const dir = mkdtempSync(join(tmpdir(), 'operation-replay-'))
let invocation = 0
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function run(args: string[]) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const stdoutPath = join(dir, `${invocation++}.stdout`)
    const stderrPath = join(dir, `${invocation}.stderr`)
    const stdout = openSync(stdoutPath, 'w')
    const stderr = openSync(stderrPath, 'w')
    // File descriptors also work in runners that cannot capture subprocess pipes.
    const child = spawn(process.execPath, [script, ...args], { timeout: 25_000, cwd: dir, stdio: ['ignore', stdout, stderr] })
    closeSync(stdout)
    closeSync(stderr)
    child.on('error', reject)
    child.on('close', status => resolve({
      status, stdout: readFileSync(stdoutPath, 'utf8'), stderr: readFileSync(stderrPath, 'utf8'),
    }))
  })
}

describe('operation replay CLI', { timeout: 30_000 }, () => {
  it('exits 0 for the sample from any working directory and prints a short summary', async () => {
    const result = await run([fixturePath])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('MATCH ridge-relay seed 42, valley then commit: 61472 (gold), 28.850 s, complete')
    expect(result.stdout).toContain('transit: claimed 18737, actual 18737, difference 0')
    expect(result.stderr).toBe('')
  })

  it('exits 1 for an intact file whose stage claim differs', async () => {
    const claimed = structuredClone(fixture.claimed)
    claimed.stages.transit += 10
    const path = join(dir, 'wrong-score.json')
    writeFileSync(path, serializeOperationReplayFile(replayFileTranscript(fixture), claimed))
    const result = await run([path])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('MISMATCH')
    expect(result.stdout).toContain('transit: claimed 18747, actual 18737, difference -10')
    expect(result.stderr).toBe('')
  })

  it.each([
    ['truncated', '{', 'invalid-json'],
    ['tampered', JSON.stringify({ ...fixture, seed: 73 }), 'integrity-mismatch'],
  ])('exits 2 for %s input with a specific reason', async (name, contents, reason) => {
    const path = join(dir, `${name}.json`)
    writeFileSync(path, contents)
    const result = await run([path])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`Invalid replay: ${reason} at $`)
    expect(result.stderr).toContain(JSON.stringify(path))
    expect(result.stdout).toBe('')
  })

  it.each([
    ['root', fixtureText.replace('{', '{"seed":0,'), '$.seed'],
    ['nested', fixtureText.replace('"total":', '"total":99999,"total":'), '$.claimed.total'],
    ['sample', fixtureText.replace('"speed":', '"speed":0,"speed":'), '$.samples.egress[0].speed'],
    ['escape-equivalent', fixtureText.replace('"total":', String.raw`"\u0074otal":99999,"total":`), '$.claimed.total'],
  ])('exits 2 for duplicate %s keys even when the last value preserves the hash', async (name, contents, fieldPath) => {
    const path = join(dir, `duplicate-${name}.json`)
    writeFileSync(path, contents)
    const result = await run([path])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`Invalid replay: duplicate-key at ${fieldPath}`)
    expect(result.stdout).toBe('')
  })

  it('exits 2 for an unreadable file', async () => {
    const result = await run([join(dir, 'missing.json')])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`Cannot read replay ${JSON.stringify(join(dir, 'missing.json'))}: ENOENT`)
    expect(result.stderr).not.toContain('Invalid replay:')
    expect(result.stdout).toBe('')
  })

  it('rejects directories explicitly rather than depending on OS read behavior', async () => {
    const result = await run([dir])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`Cannot read replay ${JSON.stringify(dir)}: expected a regular file`)
    expect(result.stdout).toBe('')
  })

  it('rejects an oversized file at the reader before decoding its content', async () => {
    const path = join(dir, 'oversized.json')
    writeFileSync(path, '')
    truncateSync(path, 16 * 1024 * 1024 + 1)
    const result = await run([path])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`Cannot read replay ${JSON.stringify(path)}: too-large at $`)
    expect(result.stdout).toBe('')
  })

  it.each([{ args: [] }, { args: [fixturePath, fixturePath] }])('exits 2 for incorrect arguments %#', async ({ args }) => {
    const result = await run(args)
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('usage: npm run verify:operation -- <file>')
    expect(result.stderr).toContain(`Expected exactly one replay file; received ${args.length} arguments.`)
    expect(result.stderr).toContain('Exit codes: 0 match, 1 mismatch, 2 unreadable or invalid.')
    expect(result.stderr).not.toContain('Invalid replay:')
    expect(result.stdout).toBe('')
  })
})
