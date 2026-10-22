// Bounded final proof. Retains all native timing observations and uses the
// existing frame-metric acceptance helper rather than another timing system.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { assertCaptureFreeTiming } from './lib/review-frame-metrics.mjs'

const root = 'docs/reviews/generator'
const json = async path => JSON.parse(await readFile(`${root}/${path}`, 'utf8'))
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const currentFiles = execFileSync('git', ['ls-files','--cached','--others','--exclude-standard','-z','--','src'], {encoding:'utf8'}).split('\0').filter(Boolean).sort()
const hashes = Object.fromEntries(await Promise.all(currentFiles.map(async file => [file, digest(await readFile(file))])))
const checkHashes = receipt => {
 for (const [file, hash] of Object.entries(receipt.sourceHashes)) assert.equal(hash, hashes[file] ?? digest(execFileSync('cat', [file])), `source drift: ${file}`)
 assert.deepEqual(Object.keys(receipt.sourceHashes).filter(f => f.startsWith('src/')).sort(), currentFiles)
}
const geometry = await json('mission-polish-c/geometry.json')
const simulation = await json('mission-polish-c/simulation.json')
const before = await json('mission-polish-a/geometry.json')
assert.equal(geometry.pass, true); assert.equal(simulation.pass, true)
checkHashes(geometry); checkHashes(simulation)
assert.equal(geometry.catalog.length, 72)
const expected = geometry.catalog.flatMap(c => [42,1337,9001].map(seed => `${c.original.id}:${seed}`)).sort()
const labels = { 'desert-run':'DESERT RUN', 'mountain-valley-run':'MOUNTAIN VALLEY RUN', 'coastal-island-run':'COASTAL ISLAND RUN', 'volcanic-run':'VOLCANIC RUN', 'waterway-run':'WATERWAY' }
for (const receipt of [geometry, simulation]) {
 assert.deepEqual(receipt.rows.map(r => `${r.mission}:${r.seed}`).sort(), expected)
 assert.ok(receipt.rows.every(r => r.pass && r.gates === 5))
}
for (const r of geometry.rows) { assert.equal(r.routeLabel, labels[r.theme]); assert.ok(r.briefing.includes(`ROUTE ${labels[r.theme]}`)) }
assert.ok(simulation.rows.every(r => r.spawnSafe && r.misses === 0 && Math.abs(r.localX) < 9 && Math.abs(r.localZ) < 60))
const changes = geometry.catalog.map(({original:c,resolved}) => {
 const old = before.catalog.find(x => x.original.id === c.id)
 for (const key of ['seed','profile','weather','weatherShift','timeOfDay','windSide','contractCatalog']) assert.deepEqual(c[key], old.original[key], `${c.id}: ${key}`)
 return { mission:c.id, name:old.original.label !== c.label, description:old.original.detail !== c.detail,
  theme:old.resolved.terrainTheme !== resolved.terrainTheme,
  routeLabel:before.rows.find(r => r.mission === c.id && r.seed === 42).routeLabel !== geometry.rows.find(r => r.mission === c.id && r.seed === 42).routeLabel }
})
const counts = Object.fromEntries(['name','description','theme','routeLabel'].map(key => [key, changes.filter(c => c[key]).length]))
assert.deepEqual(counts, {name:10, description:39, theme:1, routeLabel:70})

// This allowlist is the complete production-source delta from 10.990. It
// protects physics, nitro, compositor, seam/shader fixes, collision and budgets.
const allowed = ['src/core/Version.ts','src/systems/CourseLibrary.ts','src/systems/LegacyMissionGenerator.ts','src/systems/Mission.ts'].sort()
const changed = execFileSync('git', ['diff','f6bbd9a4','--name-only','--','src'], {encoding:'utf8'}).trim().split('\n').filter(Boolean).sort()
assert.deepEqual(changed, allowed)

const pilot = await readFile('scripts/browser-generator.js','utf8')
assert.equal(simulation.pilotSha256, digest(pilot.slice(0,pilot.indexOf('window.__training.catalog='))))
const hook = pilot + '\n' + await readFile('scripts/observe-mission-polish.js','utf8')
const rows = []
for (const [mission,seed] of [['coastal-run',42],['waterway-tour',1337],['river-run',42]]) {
 const path = `mission-polish-c-browser/${mission}-${seed}/run.json`, r = await json(path), f = r.final
 assert.equal(r.pass,true); assert.deepEqual(r.errors,[])
 assert.equal(r.timingEligible,true); assert.equal(r.timingStart.state.playing,true)
 assert.equal(r.timingStart.state.course,mission); assert.equal(r.timingStart.state.seed,seed)
 assert.ok(r.frameTimes[0].start >= r.timingStart.at)
 assert.equal(f.course,mission);assert.equal(f.seed,seed)
 assert.equal(f.status,'landed');assert.equal(f.phase,'complete');assert.equal(f.next,5);assert.equal(f.resultsOpen,true)
 assert.equal(f.result.medal,'gold');assert.ok(f.gates.every(g => g.passed))
 assert.equal(f.nitroRefills.length,5)
 assert.ok(f.nitroRefills.every(s => Math.abs(s.after.fraction-Math.min(1,s.before.fraction+.25)) < 1e-9))
 assert.ok(Math.abs(f.contact.localX)<9 && Math.abs(f.contact.localZ)<60)
 assert.equal(f.contextAttributes.desynchronized,true)
 assert.equal(f.routeLabel,labels[f.missionSettings.terrainTheme])
 const catalog = geometry.catalog.find(c => c.original.id === mission)
 for (const key of ['label','detail','profile','weather','weatherShift','timeOfDay','windSide','contractSeed']) assert.deepEqual(f.missionSettings[key],catalog.resolved[key], `${path}: ${key}`)
 if(catalog.resolved.weather)assert.equal(f.weather.id,catalog.resolved.weather)
 if(catalog.resolved.timeOfDay !== undefined)assert.equal(f.timeOfDay,catalog.resolved.timeOfDay)
 assert.equal(r.samples.filter(s => s.seconds>10 && !s.coverage).length,0)
 checkHashes(r.build);assert.equal(r.build.hookSha256,digest(hook));assert.equal(r.build.production,true);assert.equal(r.build.minified,true)
 const metrics = assertCaptureFreeTiming(r)
 for (const [key,value] of Object.entries(metrics)) assert.equal(r.metrics[key],value)
 for (let i=1;i<r.frameTimes.length;i++)assert.ok(Math.abs(r.frameTimes[i].start-r.frameTimes[i-1].end)<.001)
 const heapPeakMB = Math.max(...r.samples.map(s => s.heapMB),r.metrics.heapMB)
 assert.ok(heapPeakMB<200);assert.equal(metrics.over100,0)
 rows.push({mission,seed,...metrics,heapPeakMB,medal:f.result.medal,receipt:path,buildId:r.build.buildId})
}
const baseline=[]
for (const [part,mission,seed] of [['frame-spikes-proof-b','coastal-run',42],['frame-spikes-proof-b-repeat','coastal-run',42],['frame-spikes-proof-b','waterway-tour',1337]]) {
 const r = await json(`${part}/${mission}-${seed}/run.json`)
 const metrics = assertCaptureFreeTiming(r)
 const current = await json(`mission-polish-c-browser/${mission}-${seed}/run.json`)
 assert.deepEqual(current.final.gates,r.final.gates,`${mission}: gate geometry regression`)
 assert.equal(r.build.hookSha256,digest(pilot))
 for (const file of currentFiles) if(!allowed.includes(file))assert.equal(r.build.sourceHashes[file],hashes[file],`protected source drift: ${file}`)
 baseline.push({part,mission,seed,...metrics,heapPeakMB:Math.max(...r.samples.map(s=>s.heapMB),r.metrics.heapMB)})
}
// Frame counts are noisy in 10.990. Keep both Coastal baseline observations,
// and report comparison instead of hiding either or asserting an FPS gain.
for (const current of rows.filter(r => r.mission !== 'river-run')) {
 const prior = baseline.filter(r => r.mission === current.mission)
 assert.ok(current.p95 <= Math.max(...prior.map(r => r.p95)) + .2, `${current.mission}: p95 regression`)
 assert.ok(current.over50 <= Math.max(...prior.map(r => r.over50)), `${current.mission}: spike-count regression`)
 assert.ok(current.max <= Math.max(...prior.map(r => r.max)) + 1, `${current.mission}: longest-interval regression`)
}
const result={pass:true,missions:72,cases:216,counts,changes,sourceHashes:hashes,productionChanges:changed,rows,baseline}
await writeFile(`${root}/mission-polish-c/proof.json`,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({pass:true,counts,rows,baseline},null,2))
