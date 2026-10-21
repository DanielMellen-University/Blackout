// Approved Waterway migration: existing controls-only runner and receipt format.
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const part = process.env.REVIEW_PART || 'waterway-b-full'
const mode = process.env.WATERWAY_MODE || 'full'
const root = `docs/reviews/generator/${part}`
await mkdir(root, { recursive: true })
const server = await createServer({ server: { middlewareMode: true } })
let jobs = []
try {
 const lib = await server.ssrLoadModule('/src/systems/CourseLibrary.ts')
 const { sortieContractLabelForSeed } = await server.ssrLoadModule('/src/systems/SortieContract.ts')
 const { generateLegacyMission } = await server.ssrLoadModule('/src/systems/LegacyMissionGenerator.ts')
 const { setWorldSeed } = await server.ssrLoadModule('/src/world/noise.ts')
 const { setTerrainProfile } = await server.ssrLoadModule('/src/world/TerrainProfile.ts')
 const terrain = await server.ssrLoadModule('/src/world/terrainSample.ts')
 const { buildMissionRoute, missionLegClearance } = await server.ssrLoadModule('/src/systems/Mission.ts')
 const audit = []
 const verify = c => {
  const a = generateLegacyMission(c, c.seed), s = a.spec, pad = s.landingRunway
  setWorldSeed(c.seed); setTerrainProfile(s.terrain); terrain.setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  const bodies = s.course.slice(0, 2).map(p => terrain.waterBodyFromClimate(terrain.sampleClimate(p.x, p.z)))
  assert.deepEqual(bodies, ['river', 'lake'])
  const route = buildMissionRoute(s.start.x, s.start.y, s.start.z, s.start.yaw, c.profile, a.modifier)
  let previous = s.start
  for (const [leg, p] of route.entries()) {
   const dx = p.x - previous.x, dz = p.z - previous.z, length = Math.hypot(dx, dz)
   for (let i = 1; i <= 60; i++) for (const side of [-34, 0, 34]) {
    const t = i / 60, x = previous.x + dx * t + dz / length * side, z = previous.z + dz * t - dx / length * side
    assert.ok(previous.y + (p.y - previous.y) * t - terrain.sampleTerrainSurfaceHeightFast(x, z) >= missionLegClearance(leg, length * t, length) - .5)
   }
   previous = p
  }
  setTerrainProfile(null); terrain.clearOpsPad()
  return { bodies, solvable: true }
 }
 for (let day = 0; day < 1500; day++) {
  const date = Date.UTC(2025, 0, 1 + day), c = lib.resolveCourseDefinition(lib.courseDefinitionForId('daily-ops'), date)
  const objective = sortieContractLabelForSeed(c.contractSeed ?? c.seed, 5, true)
  if (objective === 'WATERWAY TOUR') {
   assert.equal(c.terrainTheme, 'waterway-run')
   assert.equal(c.seed, lib.dailyOpsSeed(date))
   audit.push({ period: lib.dailyOpsDayKey(date), seed: c.seed, profile: c.profile, theme: c.terrainTheme, objective, ...verify(c) })
  }
 }
 assert.ok(audit.length >= 3)
 await writeFile(`${root}/period-audit.json`, JSON.stringify({ dailyPeriods: 1500, waterwayPeriods: audit.length, pass: true, rows: audit }, null, 2) + '\n')
 for (const course of ['monsoon-run', 'waterway-tour']) jobs.push({ course, seeds: '42,1337,9001', query: '', profile: 'waterway-run' })
 for (const [course, flag, seedFn, keyFn] of [
  ['daily-ops', 'day', 'dailyOpsSeed', 'dailyOpsDayKey'],
  ['weekly-ops', 'week', 'weeklyOpsSeed', 'weeklyOpsWeekKey'],
  ['monthly-ops', 'month', 'monthlyOpsSeed', 'monthlyOpsMonthKey'],
 ]) {
  const seen = new Set()
  for (let day = 0; day < 5000 && seen.size < 3; day++) {
   const date = flag === 'month' ? Date.UTC(2025, day, 15) : Date.UTC(2025, 0, 1 + day * (flag === 'week' ? 7 : 1)), period = lib[keyFn](date)
   if (seen.has(period)) continue
   const c = lib.resolveCourseDefinition(lib.courseDefinitionForId(course), date)
   if (sortieContractLabelForSeed(c.contractSeed ?? c.seed, 5, true) !== 'WATERWAY TOUR') continue
   assert.equal(c.seed, lib[seedFn](date)); assert.equal(c.terrainTheme, 'waterway-run'); verify(c)
   seen.add(period)
   jobs.push({ course, seeds: String(c.seed), query: `&${flag}=${period}`, profile: c.terrainTheme, period })
  }
  assert.equal(seen.size, 3, `${course} Waterway period sample`)
 }
 if (mode === 'visual') jobs = [{ course: 'waterway-run', seeds: '42,1337,9001,31415', query: '' }]
 if (process.env.WATERWAY_FIXED_ONLY === '1') jobs = jobs.filter(j => j.course === 'monsoon-run' || j.course === 'waterway-tour')
} finally { await server.close() }
await writeFile(`${root}/jobs.json`, JSON.stringify(jobs, null, 2) + '\n')
await writeFile(`${root}/execution.json`, JSON.stringify({ mode, browserConcurrency: 1, timingEligible: mode === 'full', completedFrameCapture: mode !== 'full' }, null, 2) + '\n')
if (process.env.WATERWAY_AUDIT_ONLY === '1') process.exit(0)
for (const [i, job] of jobs.entries()) {
 console.log(`JOB ${i + 1}/${jobs.length}`, JSON.stringify(job))
 await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/review-generator.mjs'], { stdio: 'inherit', env: { ...process.env,
   REVIEW_PART: part, REVIEW_COURSE: job.course, REVIEW_SEEDS: job.seeds, REVIEW_QUERY: job.query,
   REVIEW_CAPTURE: mode === 'full' ? '0' : '1', REVIEW_SMOKE: mode === 'full' ? '0' : '1',
   REVIEW_PROFILE: '0', REVIEW_RESUME: '1', REVIEW_VISUAL_GATE: '2',
  } })
  child.once('error', reject)
  child.once('exit', code => code === 0 ? resolve() : reject(Error(`Waterway flight failed: ${job.course}`)))
 })
}
