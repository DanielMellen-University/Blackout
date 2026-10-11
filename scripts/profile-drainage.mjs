import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// CPU-only graph review. No browser, HTTP listener, or gameplay cache changes.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baselineRef = process.argv.find(a => a.startsWith('--baseline='))?.slice(11) ?? 'e4c122a'
const baseline = execFileSync('git', ['show', `${baselineRef}:src/world/RegionalDrainage.ts`], { cwd: root, encoding: 'utf8' })
const cacheDir = await mkdtemp(join(tmpdir(), 'blackout-drainage-review-'))
const results = []
try {
  for (const before of [true, false]) {
    const loader = await createServer({ root, cacheDir: join(cacheDir, before ? 'before' : 'after'),
      optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
      plugins: [{ name: 'drainage-review', enforce: 'pre', transform(code, id) {
        if (id.endsWith('/src/world/RegionalDrainage.ts')) return (before ? baseline : code) +
          '\nexport {node as reviewNode, parent as reviewParent, dominantUpstream as reviewUpstream, carriesRiver as reviewChannel, hasLongRoute as reviewLongRoute, basin as reviewBasin}\n'
      } }],
    })
    try {
      const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
      const m = await loader.ssrLoadModule('/src/world/RegionalDrainage.ts')
      let formedLength = 0, formedEdges = 0, dryTerminals = 0
      const lengths = [], begin = performance.now()
      for (const seed of [1, 42, 1337]) {
        setWorldSeed(seed)
        for (let gz = -64; gz < 64; gz++) for (let gx = -64; gx < 64; gx++) {
          const n = m.reviewNode(gx, gz), p = m.reviewParent(n)
          if (p && m.reviewChannel(n)) { formedLength += Math.hypot(n.x - p.x, n.z - p.z); formedEdges++ }
          if (p || !m.reviewLongRoute(n)) continue
          if (n.height > 0 && !m.reviewBasin(n)) dryTerminals++
          let q = n, length = 0
          for (let i = 0; i < 512; i++) {
            const upstream = m.reviewUpstream(q)
            if (!upstream || !m.reviewChannel(upstream)) break
            length += Math.hypot(upstream.x - q.x, upstream.z - q.z); q = upstream
          }
          lengths.push(length)
        }
      }
      lengths.sort((a, b) => a - b)
      const result = { version: before ? baselineRef : 'working-tree', seeds: [1, 42, 1337], extentKm: 256,
        systems: lengths.length, meanMainStemM: lengths.reduce((a, b) => a + b, 0) / lengths.length,
        medianMainStemM: lengths[Math.floor(lengths.length / 2)], maxMainStemM: lengths.at(-1),
        formedEdges, formedLengthM: formedLength, dryTerminals, cpuMs: performance.now() - begin }
      console.log(JSON.stringify(result)); results.push(result)
    } finally { await loader.close() }
  }
  console.log(JSON.stringify({ meanLengthRatio: results[1].meanMainStemM / results[0].meanMainStemM,
    formedLengthRatio: results[1].formedLengthM / results[0].formedLengthM }))
} finally { await rm(cacheDir, { recursive: true, force: true }) }
