// Repeated empty-cache CPU work, separated from browser rendering and tests.
import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { cpus, availableParallelism } from 'node:os'
const args = new URLSearchParams(process.argv.slice(2).map(s => s.replace(/^--/, '')).join('&'))
const samples = Number(args.get('samples') || 12)
const ref = args.get('baseline')
const output = args.get('output')
if (!output || !Number.isInteger(samples) || samples < 3) throw Error('Use --output=file.json --samples=12 [--baseline=ref]')
const owned = ['TerrainGeometry', 'TerrainWaterBed', 'WaterSystem', 'Coastline', 'terrainSample']
const frozen = new Map(ref ? owned.map(name => [`/src/world/${name}.ts`, execFileSync('git', ['show', `${ref}:src/world/${name}.ts`], { encoding: 'utf8' })]) : [])
const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  plugins: [{ name: 'cold-review-reference', enforce: 'pre', transform(code, id) {
    for (const [suffix, source] of frozen) if (id.endsWith(suffix)) return source
  } }] })
const summary = values => {
  const a = values.toSorted((a,b) => a-b), n = a.length
  return { median: n % 2 ? a[n>>1] : (a[n/2-1]+a[n/2])/2, p95: a[Math.ceil(n*.95)-1], max: a.at(-1) }
}
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
try {
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { setTerrainProfile } = await loader.ssrLoadModule('/src/world/TerrainProfile.ts')
  const { clearOpsPad } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const { prepareHydrologyInBoundsSteps, waterLandmarks, riverReaches } = await loader.ssrLoadModule('/src/world/Hydrology.ts')
  const { generateTerrainGeometrySteps } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const results = []
  for (const seed of [1,73,1337]) for (const kind of ['hydrology','near','far']) {
    const [x,z] = seed === 1337 ? [63840,34860] : seed === 73 ? [-8400,-20580] : [-33600,-18480]
    const cx = Math.floor(x/32000), cz = Math.floor(z/32000), runs = []
    for (let run = 0; run < samples; run++) {
      clearOpsPad(); setTerrainProfile(null); setWorldSeed(seed+100000)
      const invalid = prepareHydrologyInBoundsSteps(x,z,x,z); invalid.next(); invalid.return()
      setWorldSeed(seed)
      const steps = kind === 'hydrology' ? prepareHydrologyInBoundsSteps(x,z,x,z)
        : generateTerrainGeometrySteps(x,z,kind === 'near' ? 0 : 2,kind === 'near' ? 1 : 8)
      const phases = {}, slices = [], startCpu = process.cpuUsage(), start = performance.now()
      let value
      while (true) {
        const at = performance.now(), r = steps.next(), ms = performance.now()-at
        const phase = r.done ? 'finalize' : r.value
        const p = phases[phase] ??= { totalMs: 0, maxMs: 0, count: 0 }
        p.totalMs += ms; p.maxMs = Math.max(p.maxMs,ms); p.count++; slices.push(ms)
        if (r.done) { value = r.value; break }
      }
      const wallMs = performance.now()-start, cpu = process.cpuUsage(startCpu)
      const identity = kind === 'hydrology' ? hash({ basins:waterLandmarks(cx,cz), reaches:riverReaches(cx,cz) }) : (() => {
        const h = createHash('sha256')
        for (const a of [value.heights,value.waterLevels,...[value.ground,value.water].flatMap(g => g ? [...Object.values(g.attributes).map(a=>a.array),g.index].filter(Boolean) : [])])
          h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength))
        return h.digest('hex')
      })()
      runs.push({ wallMs, workMs:slices.reduce((a,b)=>a+b,0), processCpuMs:(cpu.user+cpu.system)/1000,
        maxSliceMs:Math.max(...slices), slices:slices.length, phases, sha256:identity })
    }
    const phases = [...new Set(runs.flatMap(r=>Object.keys(r.phases)))].map(phase=>({phase,
      totalMs:summary(runs.map(r=>r.phases[phase]?.totalMs||0)), largestSliceMs:summary(runs.map(r=>r.phases[phase]?.maxMs||0))}))
    results.push({ seed, kind, x,z, runs, workMs:summary(runs.map(r=>r.workMs)), processCpuMs:summary(runs.map(r=>r.processCpuMs)),
      largestSliceMs:summary(runs.map(r=>r.maxSliceMs)), phases })
    console.log(seed,kind,results.at(-1).workMs,results.at(-1).largestSliceMs)
  }
  await writeFile(output,JSON.stringify({node:process.version,cpu:cpus()[0].model,availableParallelism:availableParallelism(),ref:ref||'working-tree',samples,
    method:'Sequential immediate iterator drain. Empty hydrology and drainage caches per repetition by queried alternate seed. JIT is retained, first repetition included. Work is summed next() wall time; process CPU includes iterator/profiler overhead. Largest slice is one next(). Hydrology builds one catchment; tiles include all cold halo catchments. No browser or tests active.',results},null,2)+'\n')
} finally { await loader.close() }
