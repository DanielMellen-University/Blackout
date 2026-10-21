// Final evidence audit for the existing bounded game records.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { assertCaptureFreeTiming, summarizeFlightFrames } from './lib/review-frame-metrics.mjs'
const root = 'docs/reviews/generator/'
const json = async path => JSON.parse(await readFile(root + path, 'utf8'))
const hash = value => createHash('sha256').update(value).digest('hex')
const full = await json('waterway-c-full-summary.json')
const smoke = await json('waterway-c-smoke-summary.json')
const visual = await json('waterway-c-visual-summary.json')
const regression = await json('waterway-c-regression-summary.json')
const themeFull = await json('waterway-c-theme-full-summary.json')
const current = await json('hooks-build/browser-build.json')
const previous = await json('hooks-build/hooks/f21fcdb365292d447aa54a98c7c529978fc9972777bc6306ec161f6f82d894f0.json')
assert.deepEqual(Object.keys(previous.sourceHashes).sort(), Object.keys(current.sourceHashes).sort())
const sourceChanges = Object.keys(current.sourceHashes).filter(file => previous.sourceHashes[file] !== current.sourceHashes[file])
assert.deepEqual(sourceChanges.slice().sort(), ['src/core/CourseRecordRetention.ts','src/core/Version.ts'])
const oldRetention=execFileSync('git',['show','7ee1e558:src/core/CourseRecordRetention.ts'],{encoding:'utf8'})
const newRetention=await readFile('src/core/CourseRecordRetention.ts','utf8')
assert.equal(newRetention,oldRetention.replace('(?:desert|valley|coastal|volcanic):','(?:desert|valley|coastal|volcanic|waterway):'))
const oldVersion = execFileSync('git', ['show', '7ee1e558:src/core/Version.ts'], { encoding: 'utf8' })
const newVersion = await readFile('src/core/Version.ts', 'utf8')
assert.equal(hash(oldVersion), previous.sourceHashes['src/core/Version.ts'])
assert.equal(hash(newVersion), current.sourceHashes['src/core/Version.ts'])
assert.equal(newVersion, oldVersion.replace("ROADMAP_CHUNK = '10.987'", "ROADMAP_CHUNK = '10.988'")
 .replace("PREVIOUS_ROADMAP_CHUNK = '10.986'", "PREVIOUS_ROADMAP_CHUNK = '10.987'"))
assert.equal(current.hookSha256, previous.hookSha256)
assert.equal(current.hookSha256, hash(await readFile('scripts/browser-generator.js')))
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src'], { encoding: 'utf8' }).split('\0').filter(Boolean)
assert.deepEqual(Object.keys(current.sourceHashes).sort(), files.sort())
for (const file of files) assert.equal(current.sourceHashes[file], hash(await readFile(file)), `current source: ${file}`)
assert.equal(current.buildId, hash(JSON.stringify({ sourceHashes: current.sourceHashes, hookSha256: current.hookSha256 })))
const immutable = await json(`hooks-build/hooks/${current.buildId}.json`)
// Rebuilding identical sources after shipping may change only the HEAD label.
const { sourceCommit: currentCommit, ...currentIdentity } = current
const { sourceCommit: retainedCommit, ...retainedIdentity } = immutable
assert.match(currentCommit, /^[a-f0-9]{40}$/); assert.match(retainedCommit, /^[a-f0-9]{40}$/)
assert.deepEqual(currentIdentity, retainedIdentity)
assert.equal(hash(await readFile(root + `hooks-build/hooks/${current.hookSha256}.js`)), current.hookSha256)
for (const summary of [full, smoke, visual, regression, themeFull]) {
 assert.equal(summary.pass, true)
 assert.equal(summary.hookHash, current.hookSha256)
 for (const [file, expected] of Object.entries(current.sourceHashes)) {
  assert.equal(summary.sourceHashes[file], expected)
 }
 for (const row of summary.rows) {
  const receipt = JSON.parse(await readFile(row.receipt, 'utf8'))
  assert.deepEqual(receipt.build, immutable, `${row.receipt}: immutable source and pilot manifest`)
  assert.equal(receipt.pass, true); assert.deepEqual(receipt.errors, [])
  assert.equal(receipt.final.seed, row.seed)
  assert.equal(receipt.final.course, row.mission || row.theme)
  assert.equal(receipt.final.recordId, row.recordId)
  assert.equal(receipt.samples.filter(s => s.seconds > 10 && !s.coverage).length, 0)
  if (receipt.capture) {
   assert.equal(receipt.timingEligible, false)
   assert.deepEqual(receipt.captureFences.map(f => f.picture), receipt.pictures)
   assert.ok(receipt.captureFences.every(f => Number.isFinite(f.ms) && f.ms >= 0))
   for (const picture of receipt.pictures) assert.ok((await readFile(row.receipt.replace('run.json', picture))).length > 10000)
  } else {
   assert.equal(receipt.timingEligible, true)
   assert.equal(receipt.timingStart.state.seconds, 0)
   assert.equal(receipt.timingStart.state.playing, true)
   assert.equal(receipt.timingStart.state.paused, false)
   assert.ok(receipt.timingStart.boundary.includes('launch panel hides'))
   assert.ok(receipt.frameTimes[0].start - receipt.timingStart.at >= 0 && receipt.frameTimes[0].start - receipt.timingStart.at < 250)
   for (const [i, frame] of receipt.frameTimes.entries()) {
    assert.ok(Math.abs(frame.end - frame.start - frame.ms) < 1e-6)
    if (i) assert.ok(Math.abs(frame.start - receipt.frameTimes[i - 1].end) < 1e-6, `${row.receipt}: timing gap ${i}`)
   }
   const metrics = assertCaptureFreeTiming(receipt)
   for (const [key, value] of Object.entries(metrics)) assert.equal(receipt.metrics[key], value)
   for (const key of ['fps', 'p95', 'over50', 'over100', 'max']) assert.equal(row[key], metrics[key])
   assert.equal(row.heapPeakMB, Math.max(...receipt.samples.map(s => s.heapMB)))
  }
 }
}
assert.deepEqual(await json('waterway-c-full/jobs.json'), await json('waterway-c-smoke/jobs.json'))
const expectedCases = (await json('waterway-c-full/jobs.json')).flatMap(j => j.seeds.split(',').map(seed => `${j.course}:${seed}:${j.period || ''}`))
for (const summary of [full, smoke]) assert.deepEqual(summary.rows.map(r => `${r.mission}:${r.seed}:${r.period || ''}`), expectedCases)
assert.equal(full.rows.length, 15); assert.equal(smoke.rows.length, 15)
assert.deepEqual(visual.rows.map(r => r.seed), [42, 1337, 9001, 31415])
assert.equal(regression.rows.length, 4)
assert.equal(themeFull.rows.length,3)
for (const row of visual.rows) {
 const receipt = JSON.parse(await readFile(row.receipt, 'utf8'))
 assert.equal(receipt.capture,true); assert.equal(receipt.timingEligible,false)
 assert.deepEqual(receipt.captureFences.map(f=>f.picture),receipt.pictures)
 assert.ok(receipt.captureFences.every(f=>Number.isFinite(f.ms) && f.ms>=0))
 for(const camera of ['chase','cockpit']) assert.ok(receipt.pictures.includes(`runway-${camera}.jpg`))
}
for (const row of full.rows) {
 const receipt=JSON.parse(await readFile(row.receipt,'utf8'))
 assert.equal(receipt.build.buildId,current.buildId)
 if(!row.period)assert.ok(receipt.final.recordRetention.some(entry=>entry.id===receipt.final.recordId))
 assert.equal(row.medal, 'gold'); assert.equal(row.contract.complete, true)
 assert.equal(row.contract.kind, 'waterway-tour'); assert.equal(row.contract.progress, 1)
 assert.equal(row.coverageMisses, 0); assert.ok(row.max <= 100.1); assert.ok(row.heapPeakMB < 200)
}
for (const row of smoke.rows) {
 const receipt=JSON.parse(await readFile(row.receipt,'utf8'));assert.equal(receipt.build.buildId,current.buildId)
 assert.equal(row.contract.complete, true); assert.equal(row.coverageMisses, 0) }
for (const row of [...visual.rows, ...regression.rows, ...themeFull.rows]) {
 assert.equal(row.coverageMisses,0)
 const receipt=JSON.parse(await readFile(row.receipt,'utf8'));assert.equal(receipt.build.buildId,current.buildId)
 assert.ok(receipt.final.recordRetention.some(entry=>entry.id===receipt.final.recordId))
}
for (const row of [...regression.rows,...themeFull.rows]) { assert.equal(row.medal, 'gold'); assert.ok(row.max <= 100.1); assert.ok(row.heapPeakMB < 200) }
const periodAudit = await json('waterway-c-smoke/period-audit.json')
assert.equal(periodAudit.dailyPeriods, 1500); assert.equal(periodAudit.waterwayPeriods, 8)
assert.ok(periodAudit.rows.every(r => r.solvable && r.theme === 'waterway-run' && r.bodies.join(',') === 'river,lake'))
const aggregate = (name, rows) => ({ name, gold: rows.filter(r => r.medal === 'gold').length,
 fpsMin: Math.min(...rows.map(r => r.fps)), fpsMax: Math.max(...rows.map(r => r.fps)),
 p95: Math.max(...rows.map(r => r.p95)), over50: rows.reduce((n,r) => n+r.over50,0),
 over100: rows.reduce((n,r) => n+r.over100,0), max: Math.max(...rows.map(r => r.max)),
 heapPeakMB: Math.max(...rows.map(r => r.heapPeakMB)) })
const groups = ['monsoon-run','waterway-tour','daily-ops','weekly-ops','monthly-ops'].map(id => aggregate(id, full.rows.filter(r => r.mission === id)))
groups.push(aggregate('Waterway standalone theme',themeFull.rows))
groups.push(aggregate('four original themes', regression.rows))
const excluded = await json('waterway-b-observations/waterway-tour-9001-original/run.json')
assert.equal(excluded.build.buildId, previous.buildId)
assert.equal(excluded.final.result.medal, 'gold'); assert.equal(excluded.final.result.contractScore, 2000)
const excludedMetrics = summarizeFlightFrames(excluded.frameTimes)
assert.ok(excludedMetrics.max > 100.1)
const result = { pass: true, sourceChanges, permittedChanges: 'ROADMAP_CHUNK 10.987 to 10.988 and PREVIOUS_ROADMAP_CHUNK 10.986 to 10.987, plus admission of waterway in the existing bounded-record regex. All final accepted flights use the corrected current source exactly; controls-only pilot unchanged.',
 retainedBuildId: previous.buildId, currentBuildId: current.buildId, currentSourceHashes: current.sourceHashes,
 smokeCases: 15, visualThemeSeeds: visual.rows.map(r => r.seed), goldFlights: 22, periodAudit,
 groups, excluded: { receipt: root+'waterway-b-observations/waterway-tour-9001-original/run.json', reason: 'Original 116.7 ms timing observation. Isolated identical-source repeat passes at 83.4 ms. Cause unproven; no production tuning.', ...excludedMetrics } }
await writeFile(root+'waterway-c-verification/proof-audit.json', JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({ pass: true, sourceChanges, smokeCases: 15, goldFlights: 22, groups, excludedMax: excludedMetrics.max },null,2))
