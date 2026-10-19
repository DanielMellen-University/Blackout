import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const directory = process.argv[2] || 'docs/reviews/performance-10.948'
const manifest = JSON.parse(await readFile(`${directory}/record/source-sha256.json`, 'utf8'))
const rows = [], environments = new Set(), commits = new Set()
const summarize = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  assert.ok(sorted.length > 0 && sorted.every(ms => Number.isFinite(ms) && ms > 0))
  const mean = sorted.reduce((sum, ms) => sum + ms, 0) / sorted.length
  return { samples: sorted.length, mean, fps: 1000 / mean,
    p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1),
    over50: sorted.filter(ms => ms > 50).length, over100: sorted.filter(ms => ms > 100).length }
}
const routeFrames = { city: [], world: [] }
for (let run = 1; run <= 3; run++) for (const route of ['city', 'world']) {
  const file = `record/${route}-${run}.json`
  const data = JSON.parse(await readFile(`${directory}/${file}`, 'utf8'))
  assert.ok(data.matched && data.phase === 'finished' && data.errors.length === 0, file)
  assert.ok(!data.profile && !data.trace && !data.nativeTrace && !data.graphicsTrace && !data.gpuTrace, file)
  assert.equal(data.productionDiff, '', file)
  assert.equal(data.seed, route === 'city' ? 1337 : 73, file)
  assert.equal(data.route.id, route, file)
  assert.equal(data.quality, 'balanced', file)
  // CameraSystem.modeLabel reports the chase camera as external.
  assert.equal(data.camera, 'external', file)
  assert.deepEqual(data.viewport, [1280, 720], file)
  assert.deepEqual(data.ratioRange, [1, 1], file)
  assert.equal(data.seconds, 120, file)
  assert.equal(data.distanceM, 81600, file)
  assert.equal(data.streaming.workers, 4, file)
  assert.doesNotMatch(data.gpu.renderer, /SwiftShader|llvmpipe/i, file)
  for (const [source, hash] of Object.entries(data.instrumentation)) assert.equal(manifest[source], hash, file)
  environments.add(JSON.stringify({ gpu: data.gpu, args: data.args, browser: data.browserVersion, instrumentation: data.instrumentation }))
  commits.add(data.sourceCommit)
  const frames = summarize(data.rawFrames.flight)
  for (const key of ['samples', 'p95', 'max', 'over50', 'over100']) assert.equal(frames[key], data.flightFrames[key], `${file}: ${key}`)
  assert.equal(frames.over100, data.longFrames.flight.length, file)
  assert.ok(data.heapBytes.peak >= data.heapBytes.current && data.heapBytes.peak > 0, file)
  routeFrames[route].push(...data.rawFrames.flight)
  rows.push({ file, route, run, frames, heapBytes: data.heapBytes,
    peakAbove200MB: data.heapBytes.peak > 200e6, startupFrames: data.startupFrames,
    coverageWallMs: data.launchToCoverageWallMs, flightWallMs: data.flightWallMs,
    settlements: data.settlements, streaming: data.streaming })
}
assert.equal(environments.size, 1, 'Capture environments differ')
assert.equal(commits.size, 1, 'Runtime commits differ')
const routes = Object.fromEntries(Object.entries(routeFrames).map(([route, frames]) => [route, {
  frames: summarize(frames), peakHeapBytes: Math.max(...rows.filter(row => row.route === route).map(row => row.heapBytes.peak)),
  runsAbove200MB: rows.filter(row => row.route === route && row.peakAbove200MB).length,
}]))
const summary = { sourceCommit: [...commits][0], targetBytes: 200e6,
  note: 'Fresh record only. Mean RAF FPS = 1000 / mean interval. MB = 1,000,000 bytes. Main-thread JS heap only. No forced GC. Startup intervals are separate. No matched improvement claim.',
  rows, routes }
await writeFile(`${directory}/summary.json`, JSON.stringify(summary, null, 2) + '\n')
const table = ['| Route / run | Mean FPS | Mean ms | p95 ms | Max ms | >50 / >100 ms | Heap start / end / peak MB | Peak vs 200 MB |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |']
for (const row of rows) {
  const f = row.frames
  table.push(`| ${row.route === 'world' ? 'northeast' : 'city'} / ${row.run} | ${f.fps.toFixed(2)} | ${f.mean.toFixed(2)} | ${f.p95.toFixed(1)} | ${f.max.toFixed(1)} | ${f.over50} / ${f.over100} | ${['start', 'current', 'peak'].map(key => (row.heapBytes[key] / 1e6).toFixed(1)).join(' / ')} | ${row.peakAbove200MB ? 'above' : 'within'} |`)
}
await writeFile(`${directory}/measurements.md`, table.join('\n') + '\n')
console.log(table.join('\n'))
