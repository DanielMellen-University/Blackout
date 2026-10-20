import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
const baseline = process.argv.includes('--baseline')
const sourceRef = baseline ? '39e533a' : null
const physicsFiles = ['src/aircraft/FlightModel.ts', 'src/aircraft/flightConfig.ts']
const sourceBytes = async file => sourceRef ? execFileSync('git', ['show', `${sourceRef}:${file}`]) : readFile(file)
const server = await createServer({ server: { middlewareMode: true }, plugins: [{
  name: 'frozen-physics-baseline', enforce: 'pre',
  async load(id) {
    const file = physicsFiles.find(file => id.endsWith('/' + file))
    if (sourceRef && file) return (await sourceBytes(file)).toString()
  },
}] })
try {
  const { measurePhysics } = await server.ssrLoadModule('/tests/helpers/physicsB20.ts')
  const report = measurePhysics()
  report.sourceCommit = execFileSync('git', ['rev-parse', sourceRef || 'HEAD'], { encoding: 'utf8' }).trim()
  report.sourceHashes = Object.fromEntries(await Promise.all(physicsFiles.map(async file =>
    [file, createHash('sha256').update(await sourceBytes(file)).digest('hex')])) )
  report.method = 'Calm, gear up, dry thrust, 1/120 s steps at 20000 m over flat contact; production Aircraft.step.'
  await writeFile(process.argv.slice(2).find(arg => !arg.startsWith('--')) || `docs/reviews/physics-b20/${baseline ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await server.close() }
