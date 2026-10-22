// Approved 72-mission polish proof. Reuse the production modules and pilot.
import { createServer } from 'vite'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const server = await createServer({ server: { middlewareMode: true } })
const part = process.env.POLISH_PART || 'mission-polish-a'
const seeds = (process.env.POLISH_SEEDS || '42,1337,9001').split(',').map(Number)
const rows = []
try {
 const { COURSE_LIBRARY, resolveCourseDefinition } = await server.ssrLoadModule('/src/systems/CourseLibrary.ts')
 const { auditMissionGeometry } = await server.ssrLoadModule('/scripts/lib/mission-polish.ts')
 const fixed = COURSE_LIBRARY.filter(c => c.seed !== null)
 for (const course of fixed) for (const seed of seeds) {
  try { rows.push({ ...auditMissionGeometry(course, seed), pass: true }) }
  catch (error) { rows.push({ mission: course.id, seed, pass: false, error: error.message }) }
 }
 const dir = `docs/reviews/generator/${part}`
 await mkdir(dir, { recursive: true })
 const digest = bytes => createHash('sha256').update(bytes).digest('hex')
 const files = execFileSync('git', ['ls-files','--cached','--others','--exclude-standard','-z','--','src','scripts/lib/mission-polish.ts'], {encoding:'utf8'}).split('\0').filter(Boolean)
 const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, digest(await readFile(file))])))
 await writeFile(`${dir}/geometry.json`, JSON.stringify({ pass: rows.every(r => r.pass), missions: fixed.length, seeds, sourceHashes, catalog: fixed.map(course => ({ original: course, resolved: resolveCourseDefinition(course) })), rows }, null, 2) + '\n')
 console.log(JSON.stringify({ missions: fixed.length, cases: rows.length, failures: rows.filter(r => !r.pass) }, null, 2))
 if (rows.some(r => !r.pass)) process.exitCode = 1
} finally { await server.close() }
