// Run with: node --test scripts/check-version.test.mjs (also part of npm test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

async function makeFixture(t, { version, withRoadmap } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'blackout-version-check-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'scripts'), { recursive: true })
  await cp(join(repoRoot, 'scripts', 'check-version.mjs'), join(dir, 'scripts', 'check-version.mjs'))
  for (const file of ['package.json', 'package-lock.json', 'CHANGELOG.md', 'index.html', 'README.md']) {
    await cp(join(repoRoot, file), join(dir, file))
  }
  await mkdir(join(dir, 'src', 'core'), { recursive: true })
  await cp(join(repoRoot, 'src', 'core', 'Version.ts'), join(dir, 'src', 'core', 'Version.ts'))
  if (withRoadmap !== false) {
    const roadmap = execFileSync('git', ['show', 'HEAD:docs/ROADMAP.md'], { cwd: repoRoot, encoding: 'utf8' })
    await mkdir(join(dir, 'docs'), { recursive: true })
    await writeFile(join(dir, 'docs', 'ROADMAP.md'), roadmap)
  }
  if (version) {
    const packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    packageJson.version = version
    await writeFile(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n')
  }
  return dir
}

function runCheck(dir) {
  return spawnSync(process.execPath, [join(dir, 'scripts', 'check-version.mjs')], { encoding: 'utf8' })
}

test('passes a consistent version tree', async (t) => {
  const dir = await makeFixture(t)
  const result = runCheck(dir)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Version check passed: v0\.12\.0/)
})

test('fails with named mismatches when package.json drifts', async (t) => {
  const dir = await makeFixture(t, { version: '9.9.9' })
  const result = runCheck(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /package\.json \(9\.9\.9\) does not match src\/core\/Version\.ts \(0\.12\.0\)/)
  assert.match(result.stderr, /package\.json \(9\.9\.9\) does not match package-lock\.json \(0\.12\.0\)/)
})

test('reports a missing roadmap as a version error, not a stack trace', async (t) => {
  const dir = await makeFixture(t, { withRoadmap: false })
  const result = runCheck(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /docs\/ROADMAP\.md is missing or unreadable \(ENOENT\)/)
  assert.doesNotMatch(result.stderr, /at file:\/\//)
})

test('fails when the roadmap is empty', async (t) => {
  const dir = await makeFixture(t)
  await writeFile(join(dir, 'docs', 'ROADMAP.md'), '')
  const result = runCheck(dir)
  assert.equal(result.status, 1)
  assert.doesNotMatch(result.stdout, /Version check passed/)
  assert.match(result.stderr, /docs\/ROADMAP\.md current chunk must match src\/core\/Version\.ts/)
})
