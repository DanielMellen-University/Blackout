// Match RAF intervals to main-thread trace events and sampled stacks. Worker
// threads are kept in the raw trace, never charged as main-thread execution.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
const directory = process.argv[2]
if (!directory) throw new Error('Pass a flight capture directory')
const round = n => Math.round(n * 100) / 100
for (const file of await readdir(directory)) {
  if (!/^(city|world)-\d+\.json$/.test(file)) continue
  const stem = `${directory}/${file.slice(0, -5)}`
  const data = JSON.parse(await readFile(`${stem}.json`, 'utf8'))
  let trace, cpu
  try {
    trace = JSON.parse(gunzipSync(await readFile(`${stem}.trace.json.gz`))).traceEvents
    cpu = JSON.parse(gunzipSync(await readFile(`${stem}.cpuprofile.gz`)))
  } catch { continue }
  const nav = trace.find(e => e.name === 'navigationStart' && e.args?.data?.documentLoaderURL?.includes(`seed=${data.seed}&`))
    || trace.find(e => e.name === 'review-clock-origin' && e.ph === 'b')
  if (!nav) throw new Error(`No navigation clock: ${stem}`)
  const main = trace.filter(e => e.pid === nav.pid && e.tid === nav.tid)
  const spans = main.filter(e => e.ph === 'X')
  const starts = new Map()
  for (const e of main) {
    const key = `${e.cat}/${e.name}/${e.id2?.local ?? e.id}`
    if (e.ph === 'b' && /^(terrain|settlement|drape)\./.test(e.name)) starts.set(key, e)
    if (e.ph === 'e' && starts.has(key)) {
      const start = starts.get(key)
      spans.push({ ...start, ph: 'X', dur: e.ts - start.ts })
      starts.delete(key)
    }
  }
  const nodes = new Map(cpu.nodes.map(n => [n.id, n]))
  const parents = new Map()
  for (const n of cpu.nodes) for (const child of n.children || []) parents.set(child, n.id)
  const stacks = new Map()
  for (const n of cpu.nodes) {
    const stack = []
    for (let id = n.id; id; id = parents.get(id)) {
      const f = nodes.get(id).callFrame
      stack.push({ name: f.functionName || '(anonymous)', url: f.url.replace(/^.*\/src\//, 'src/'), line: f.lineNumber + 1 })
    }
    stacks.set(n.id, stack)
  }
  let clock = cpu.startTime
  const samples = cpu.samples.map((id, i) => {
    const start = clock; clock += cpu.timeDeltas[i]
    return { start, end: clock, stack: stacks.get(id) }
  })
  const hitches = []
  for (const [phase, frames] of Object.entries(data.longFrames)) for (const frame of frames) {
    const start = nav.ts + frame.startMs * 1000, end = nav.ts + frame.endMs * 1000
    const overlap = (a, b) => Math.max(0, Math.min(end, b) - Math.max(start, a)) / 1000
    const events = spans.filter(e => overlap(e.ts, e.ts + (e.dur || 0)) > 0)
    const eventTime = e => overlap(e.ts, e.ts + (e.dur || 0))
    const methods = events.filter(e => /^(terrain|settlement|drape)\./.test(e.name))
      .map(e => ({ name: e.name, startMs: round((e.ts - nav.ts) / 1000), ms: round(e.dur / 1000), overlapMs: round(eventTime(e)) }))
    const self = new Map(), inclusive = new Map()
    for (const sample of samples) {
      const ms = overlap(sample.start, sample.end)
      if (!ms) continue
      const first = sample.stack[0], label = `${first.name} (${first.url}:${first.line})`
      self.set(label, (self.get(label) || 0) + ms)
      for (const name of new Set(sample.stack.map(f => f.name))) inclusive.set(name, (inclusive.get(name) || 0) + ms)
    }
    const rank = map => [...map].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, ms]) => ({ name, sampledMs: round(ms) }))
    // Incremental marking can dominate a frame before the short MajorGC
    // finalize event. Union all GC spans to avoid counting nested phases twice.
    const gcSpans = events.filter(e => /^(MinorGC|MajorGC|V8\.GC)/.test(e.name))
      .map(e => [Math.max(start, e.ts), Math.min(end, e.ts + (e.dur || 0))]).sort((a,b) => a[0]-b[0])
    let gcMs = 0, gcEnd = -Infinity
    for (const [a,b] of gcSpans) { gcMs += Math.max(0, b - Math.max(a, gcEnd)) / 1000; gcEnd = Math.max(gcEnd, b) }
    const readbackMs = Math.max(0, ...events.filter(e => e.name === 'GLES2::ReadPixels').map(eventTime))
    const gpuWaitMs = Math.max(0, ...events.filter(e => e.name === 'ImplementationBase::WaitForCmd').map(eventTime))
    const categories = [
      ['compositor canvas readback/GPU wait', readbackMs],
      ['settlement attachment', Math.max(...methods.filter(e => e.name === 'settlement.build').map(e => e.overlapMs), 0)],
      ['road attachment', Math.max(...methods.filter(e => e.name === 'settlement.buildRegionalRoad').map(e => e.overlapMs), 0)],
      ['staged attachment', Math.max(...methods.filter(e => e.name === 'settlement.advanceAssembly').map(e => e.overlapMs), 0)],
      ['GC', gcMs],
      ['terrain result attachment', Math.max(...methods.filter(e => e.name === 'terrain.drainBuildQueue').map(e => e.overlapMs), 0)],
      ['surface drape', Math.max(...methods.filter(e => e.name === 'drape.update').map(e => e.overlapMs), 0)],
      ['worker reply handling', events.filter(e => e.name === 'HandlePostMessage').reduce((sum, e) => sum + eventTime(e), 0)],
      ['layout', events.filter(e => e.name === 'Layout').reduce((sum, e) => sum + eventTime(e), 0)],
    ].sort((a, b) => b[1] - a[1])
    const causes = []
    const sampled = name => inclusive.get(name) || 0
    if (sampled('onFirstUse') > 20 || sampled('WebGLShader') > 20)
      causes.push('first-use shader compilation/link/introspection')
    if (sampled('regionalDrainageSteps') > 20)
      causes.push('cold synchronous hydrology preparation')
    if (gcMs > 20 || sampled('(garbage collector)') > 20)
      causes.push('GC (trace and/or sampled evidence, not summed)')
    for (const [name, ms] of categories) if (ms > 20 && name !== 'GC') causes.push(name)
    if (phase === 'startup' && sampled('reseed') > 20) causes.push('cold launch world rebuild')
    if (!causes.length) causes.push('unresolved browser/driver/scheduling gap; no dominant captured main-thread phase')
    const traceCoverage = spans.some(e => e.ts <= start) && spans.some(e => e.ts + (e.dur || 0) >= end)
    hitches.push({ phase, ...frame, causes, traceCoverage, gcMs: round(gcMs), readbackMs: round(readbackMs), gpuWaitMs: round(gpuWaitMs), dominantMeasuredPhase: { name: categories[0][0], ms: round(categories[0][1]) },
      methods, sampledSelf: rank(self), sampledInclusive: rank(inclusive),
      longestMainEvents: events.sort((a,b) => eventTime(b) - eventTime(a)).slice(0, 12)
        .map(e => ({ name: e.name, startMs: round((e.ts - nav.ts) / 1000), ms: round(e.dur / 1000), overlapMs: round(eventTime(e)), args: e.args })) })
  }
  const windows = hitches.map(h => [nav.ts + h.startMs * 1000 - 10000, nav.ts + h.endMs * 1000 + 10000])
  const excerpt = trace.filter(e => e.ph === 'M' || e.name === 'navigationStart' ||
    (e.pid === nav.pid && e.tid === nav.tid && (e.dur > 100000 || windows.some(([a,b]) => e.ts < b && e.ts + (e.dur || 0) >= a))))
  await writeFile(`${stem}.hitches.json`, JSON.stringify({ navigationClockUs: nav.ts, mainThread: { pid: nav.pid, tid: nav.tid },
    note: 'CPU times are sampled evidence. Nested spans overlap and must not be added. Unattributed time is not evidence of GC or GPU work.', hitches }, null, 2) + '\n')
  await writeFile(`${stem}.hitch-trace.json.gz`, gzipSync(JSON.stringify({ traceEvents: excerpt })))
  console.log(file, hitches.map(h => `${h.phase}:${h.ms.toFixed(1)}ms ${h.dominantMeasuredPhase.name}:${h.dominantMeasuredPhase.ms}ms`).join('; '))
}
