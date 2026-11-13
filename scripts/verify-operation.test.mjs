// Run with: node --test scripts/verify-operation.test.mjs (not part of npm test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function runVerify(file) {
  return spawnSync(process.execPath, [join(repoRoot, 'scripts', 'verify-operation.mjs'), file],
    { cwd: repoRoot, encoding: 'utf8', timeout: 120_000 })
}

test('missing replay file exits 2 with a readable error', (t) => {
  const result = runVerify(join(repoRoot, 'does-not-exist.replay.json'))
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Cannot read replay/)
})

test('oversized replay file exits 2 and names the byte limit', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'blackout-verify-operation-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'oversized.replay.json')
  await writeFile(file, Buffer.alloc(16 * 1024 * 1024 + 1, 'x'))
  const result = runVerify(file)
  assert.equal(result.status, 2)
  assert.match(result.stderr, /exceeds the 16777216-byte replay limit/)
  assert.doesNotMatch(result.stderr, /at \$/)
})
