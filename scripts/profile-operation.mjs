import { mkdirSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'

// CPU flight-model timings for the ridge relay. This does not measure FPS.
const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { operationPerformanceRecord } = await loader.ssrLoadModule('/src/systems/operation/measure.ts')
  const started = performance.now()
  const record = operationPerformanceRecord(42)
  const wallMs = performance.now() - started
  const document = { ...record, wallMs: Number(wallMs.toFixed(1)), node: process.version }
  mkdirSync(new URL('../docs/reviews/operation-11.037/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../docs/reviews/operation-11.037/performance.json', import.meta.url), `${JSON.stringify(document, null, 2)}\n`)
  console.log(JSON.stringify({ wallMs: document.wallMs, paths: Object.fromEntries(Object.entries(document.paths).map(([key, path]) => [key, {
    passed: path.passed, score: path.score, medal: path.medal, elapsedSec: path.elapsedSec, peakSpeedMps: path.peakSpeedMps, minClearanceM: path.minClearanceM,
  }])) }, null, 2))
} finally {
  await loader.close()
}
