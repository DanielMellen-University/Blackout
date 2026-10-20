import assert from 'node:assert/strict'
import { readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const dir = 'docs/reviews/physics-b20', partial = process.argv.includes('--partial')
const library = JSON.parse(await readFile(`${dir}/catalog/catalog.json`, 'utf8'))
assert.equal(library.length, 77)
assert.equal(new Set(library.map(course => course.id)).size, 77)
const files = execFileSync('git', ['ls-files', '-z', '--', 'src'], { encoding: 'utf8' }).split('\0').filter(Boolean).sort()
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
const hooks = new Set(), rows = [], missing = [], failures = []
async function check(path, course, seed) {
  let run
  try { run = JSON.parse(await readFile(path, 'utf8')) } catch (error) { if (error.code === 'ENOENT') { missing.push({ course, seed }); return } throw error }
  if (partial && !run.pass && !run.errors.length && !['crashed', 'landed'].includes(run.final?.status)) { missing.push({ course, seed, inProgress: true }); return }
  try {
    const s = run.final
    assert.equal(run.pass, true, 'Runner did not accept the flight')
    assert.deepEqual(run.errors, [])
    assert.equal(run.virtualTime, false, 'Clock diagnostic cannot count')
    assert.equal(s.course, course)
    assert.equal(s.playing, true)
    assert.equal(s.paused, false)
    assert.equal(run.build.production, true)
    assert.equal(run.build.minified, true)
    assert.deepEqual(Object.keys(run.build.sourceHashes).sort(), files)
    for (const file of files) if (file !== 'src/core/Version.ts') assert.equal(run.build.sourceHashes[file], hashes[file], `Runtime source changed: ${file}`)
    const hook = run.build.hookSha256
    if (!hooks.has(hook)) {
      const source = await readFile(`${dir}/hooks/${hook}.js`, 'utf8')
      assert.equal(createHash('sha256').update(source).digest('hex'), hook)
      assert.doesNotMatch(source, /aircraft\.reset\(|aircraft\.(?:position|velocity|orientation)\.(?:set|copy)\(|challenge\.recordGate\(|\.clock\./)
      hooks.add(hook)
    }
    assert.ok(s.seconds > 20)
    assert.ok(s.recordId.includes(':r31'))
    for (const picture of run.pictures) await access(`${path.slice(0, path.lastIndexOf('/'))}/${picture}`)
    assert.ok(run.pictures.includes('complete.jpg'))
    if (course === 'free-flight') {
      assert.equal(s.seed, seed)
      assert.ok(['roll', 'landed'].includes(s.contact.touch))
      assert.ok(Math.abs(s.contact.localX) < 9 && Math.abs(s.contact.localZ) < 60, 'Runway touchdown bounds')
      assert.ok(s.contact.speed < 75)
      assert.equal(s.onGround, true)
      assert.ok(s.speed < .1)
      assert.equal(s.phase, 'running')
      assert.equal(s.resultsOpen, false)
      assert.equal(s.result, null)
      for (const stage of ['takeoff', 'hard-turn', 'climb', 'dive', 'stall-entry', 'stall-recovery']) assert.ok(s.freeStages.some(event => event.stage === stage), stage)
      const stall = s.freeStages.find(event => event.stage === 'stall-entry'), recovery = s.freeStages.find(event => event.stage === 'stall-recovery')
      assert.ok(stall.speed < 40 && stall.vy < -2)
      assert.ok(recovery.speed > 160 && Math.abs(recovery.vy) < 5)
      assert.ok(run.samples.some(sample => sample.loadFactor > 5))
    } else {
      assert.ok(s.contact && ['roll', 'landed'].includes(s.contact.touch))
      assert.ok(Math.abs(s.contact.localX) < 9 && Math.abs(s.contact.localZ) < 60, 'Mission runway touchdown bounds')
      assert.equal(s.status, 'landed')
      assert.equal(s.phase, 'complete')
      assert.equal(s.resultsOpen, true)
      assert.equal(s.next, s.gates.length)
      assert.equal(s.gates.length, 5)
      assert.ok(s.gates.every(gate => gate.passed))
      assert.equal(s.result.gatesCleared, 5)
      assert.ok(s.result.elapsedSec > 20)
    }
    rows.push({ course, seed: s.seed, seconds: s.seconds, wallSeconds: run.wallSeconds ?? null,
      renderIntervalMs: run.renderIntervalMs, reverseApproach: run.reverseApproach ?? false, stills: run.pictures.length, status: s.status,
      phase: s.phase, gates: s.next, medal: s.result?.medal ?? null,
      contractComplete: s.result?.contractComplete ?? null,
      peakG: Math.max(...run.samples.map(sample => sample.loadFactor)),
      contact: s.contact, stoppedSpeedMps: course === 'free-flight' ? s.speed : null,
      hookSha256: hook, sourceBaseCommit: run.build.sourceCommit, path })
  } catch (error) { failures.push({ course, seed, path, error: String(error) }) }
}
for (const course of library) if (course.id !== 'free-flight') await check(`${dir}/catalog/${course.id}/run.json`, course.id)
for (const seed of [42, 73]) await check(`${dir}/free-${seed}/free-flight/run.json`, 'free-flight', seed)
const summary = { complete: rows.length === 78 && !missing.length && !failures.length, expectedFlights: 78,
  passed: rows.length, missing, failures, rows,
  method: 'Production Vite build, controls only from runway launch, native browser wall clock and production fixed-step Time. Most catalog checks use a 100 ms draw interval; four isolated repeats, the two Free flights and the initial featured checks use full draw cadence. Streaming, weather, collision, gates, scoring and record identity are active. Optional contract bonus and medal optimization are not acceptance requirements.',
  limits: 'This is playability/physics compatibility evidence. It does not certify every seed, hardware device, performance target or optional contract goal. The separate pilot/clock/server attempts do not count.' }
if (partial) console.log(JSON.stringify({ passed: summary.passed, missing: missing.length, failures }, null, 2))
else {
  assert.ok(summary.complete, JSON.stringify({ passed: summary.passed, missing, failures }, null, 2))
  await writeFile(`${dir}/browser-summary.json`, JSON.stringify(summary, null, 2) + '\n')
  const table = ['# b20 mission completion results', '', 'Every row is a runway launch, five production gate crossings and an accepted landing. Most catalog rendering is limited to 10 draws/s for compatibility checking, with four full-cadence isolated repeats; simulation and streaming keep their native cadence. Optional contract bonuses and medal optimization are outside this check.', '', '| Mission | Seed | Flight seconds | Medal | Stills |', '| --- | ---: | ---: | --- | ---: |',
    ...rows.filter(row => row.course !== 'free-flight').map(row => `| [${row.course}](catalog/${row.course}/run.json) | ${row.seed} | ${row.seconds.toFixed(1)} | ${row.medal} | [${row.stills}](catalog/${row.course}/complete.jpg) |`), '', 'Two additional full-cadence Free flights on seeds 42 and 73 include hard turns, stall/recovery, climbs/dives, runway contact and full wheel-brake stops. They remain unscored and open after landing.', '']
  await writeFile(`${dir}/mission-results.md`, table.join('\n'))
  console.log(`${rows.length} accepted flights; ${rows.reduce((sum, row) => sum + row.stills, 0)} stills`)
}
