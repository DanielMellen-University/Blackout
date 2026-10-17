import { readFile, writeFile } from 'node:fs/promises'
const directory = process.argv[2] || 'docs/reviews/performance-10.915'
const rows = [], environments = new Set()
for (const stage of ['before', 'after']) for (const route of ['city', 'world']) for (let run = 1; run <= 3; run++) {
  const path = `${stage}/${route}-${run}.json`
  const data = JSON.parse(await readFile(`${directory}/${path}`, 'utf8'))
  if (!data.matched || !data.profile || !data.trace || data.phase !== 'finished' || data.distanceM !== 81600 ||
    data.seed !== (route === 'city' ? 1337 : 73) || data.viewport.join(',') !== '1280,720' ||
    data.ratioRange.join(',') !== '1,1' || data.errors.length || data.streaming.workers !== 4) throw new Error(`Unmatched: ${path}`)
  environments.add(JSON.stringify({ gpu: data.gpu, args: data.args, browser: data.browserVersion,
    instrumentation: data.instrumentation, quality: data.quality, camera: data.camera }))
  const frames = data.rawFrames.flight.slice().sort((a,b) => a-b)
  const f = data.flightFrames
  if (frames.length !== f.samples || frames.at(-1) !== f.max || frames[Math.floor(frames.length * .99)] !== f.p99 ||
    frames.filter(x => x > 100).length !== data.longFrames.flight.length) throw new Error(`Bad samples: ${path}`)
  const attribution = JSON.parse(await readFile(`${directory}/${stage}/${route}-${run}.hitches.json`, 'utf8'))
  if (attribution.hitches.length !== data.longFrames.startup.length + data.longFrames.flight.length) throw new Error(`Missing hitch evidence: ${path}`)
  rows.push({ path, stage, route, run, frames: { ...f, mean: frames.reduce((a,b) => a+b,0) / frames.length },
    startupFrames: data.startupFrames, coverageWallMs: data.launchToCoverageWallMs, airfieldReadyMs: data.airfieldReadyMs,
    heapBytes: data.heapBytes, settlements: data.settlements.peak })
}
if (environments.size !== 1) throw new Error('Capture environments or instrumentation differ')
const table = ['| Stage / route / run | Mean ms | Median ms | p95 ms | p99 ms | Max ms | >50 / >100 ms | Peak heap MB | Boot ready / coverage ms |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
for (const r of rows) table.push(`| ${r.stage} / ${r.route} / ${r.run} | ${[r.frames.mean,r.frames.median,r.frames.p95,r.frames.p99,r.frames.max].map(x=>x.toFixed(1)).join(' | ')} | ${r.frames.over50} / ${r.frames.over100} | ${(r.heapBytes.peak/1e6).toFixed(1)} | ${r.airfieldReadyMs.toFixed(0)} / ${r.coverageWallMs.toFixed(0)} |`)
await writeFile(`${directory}/summary.json`, JSON.stringify(rows, null, 2) + '\n')
await writeFile(`${directory}/measurements.md`, table.join('\n') + '\n')
console.log(table.join('\n'))
