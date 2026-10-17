import { readFile, writeFile } from 'node:fs/promises'
const directory = process.argv[2] || 'docs/reviews/performance-10.914'
const runtime = await readFile(`${directory}/before/AdaptiveResolution.runtime.js`, 'utf8')
if (runtime !== await readFile(`${directory}/after/AdaptiveResolution.runtime.js`, 'utf8')) {
  throw new Error('Resolution lock runtime differs')
}
const manifests = Object.fromEntries(await Promise.all(['before', 'after'].map(async stage =>
  [stage, JSON.parse(await readFile(`${directory}/${stage}/source-sha256.json`, 'utf8'))])))
if (manifests.before['src/main.ts'] !== manifests.after['src/main.ts']) throw new Error('Review frame hooks differ')
const rows = []
for (const stage of ['before', 'after']) for (const route of ['city', 'world']) for (let run = 1; run <= 3; run++) {
  const path = `${stage}/${route}-${run}.json`
  const data = JSON.parse(await readFile(`${directory}/${path}`, 'utf8'))
  if (!data.matched || data.profile || data.phase !== 'finished' || data.distanceM !== 81600
    || data.seed !== (route === 'city' ? 1337 : 73) || data.viewport.join(',') !== '1280,720'
    || data.ratioRange.join(',') !== '1,1') throw new Error(`Unmatched run: ${path}`)
  const frames = data.rawFrames.flight.slice().sort((a, b) => a - b)
  const p99 = frames[Math.floor(frames.length * .99)]
  if (p99 !== data.flightFrames.p99 || frames.length !== data.flightFrames.samples) throw new Error(`Bad raw samples: ${path}`)
  for (const [path, hash] of Object.entries(data.instrumentation)) {
    if (manifests[stage][path] !== hash) throw new Error(`Instrumentation source differs: ${stage}/${path}`)
  }
  rows.push({ path, stage, route, run, frames: { ...data.flightFrames, mean: frames.reduce((a,b) => a+b,0) / frames.length }, heapBytes: data.heapBytes,
    coverageWallMs: data.launchToCoverageWallMs, flightWallMs: data.flightWallMs,
    settlements: data.settlements, streaming: data.streaming })
}
const environments = await Promise.all(rows.map(async row => {
  const data = JSON.parse(await readFile(`${directory}/${row.path}`, 'utf8'))
  return JSON.stringify({ gpu: data.gpu, args: data.args, browserVersion: data.browserVersion,
    instrumentation: { ...data.instrumentation, 'src/core/AdaptiveResolution.ts': runtime }, quality: data.quality, camera: data.camera })
}))
if (new Set(environments).size !== 1) throw new Error('Environment or instrumentation differs between runs')
await writeFile(`${directory}/summary.json`, JSON.stringify(rows, null, 2) + '\n')
const table = ['| Stage / route / run | Mean ms | Median ms | p95 ms | p99 ms | Max ms | >50 / >100 ms | Heap start / end / peak MB | Coverage ms |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
for (const row of rows) {
  const f = row.frames, heap = row.heapBytes
  table.push(`| ${row.stage} / ${row.route} / ${row.run} | ${f.mean.toFixed(1)} | ${f.median.toFixed(1)} | ${f.p95.toFixed(1)} | ${f.p99.toFixed(1)} | ${f.max.toFixed(1)} | ${f.over50} / ${f.over100} | ${[heap.start, heap.current, heap.peak].map(x => (x / 1e6).toFixed(1)).join(' / ')} | ${row.coverageWallMs.toFixed(0)} |`)
}
await writeFile(`${directory}/measurements.md`, table.join('\n') + '\n')
console.log(table.join('\n'))
