// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright index.mjs.
// Example: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/profile-flight.mjs before
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { pipeline } from 'node:stream/promises'
import { gzipSync, createGzip } from 'node:zlib'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const stage = process.argv[2] || 'before'
if (!/^[a-z0-9-]+$/.test(stage)) throw new Error('Invalid output label')
const directory = `${process.env.REVIEW_DIRECTORY || 'docs/reviews/performance-10.914'}/${stage}`
await mkdir(directory, { recursive: true })
const args = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
  '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-precise-memory-info']
const routes = (process.env.REVIEW_ROUTES || 'city,world').split(',')
const repetitions = Number(process.env.REVIEW_RUNS || 3)
const profile = process.env.REVIEW_PROFILE === '1'
const trace = process.env.REVIEW_TRACE === '1'
const gpuTrace = process.env.REVIEW_GPU_TRACE === '1'
const nativeTrace = process.env.REVIEW_NATIVE_TRACE === '1'
const nativeContinuous = process.env.REVIEW_NATIVE_CONTINUOUS === '1'
const traceStart = Number(process.env.REVIEW_TRACE_START || 85)
const traceEnd = Number(process.env.REVIEW_TRACE_END || 120)
const instrumentation = Object.fromEntries(['src/debug/FlightReview.ts', 'src/core/AdaptiveResolution.ts'].map(path =>
  [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
for (let run = 1; run <= repetitions; run++) for (const route of routes) {
  const name = `${route}-${run}`
  const seed = route === 'world' ? 73 : 1337
  try {
    const existing = JSON.parse(await readFile(`${directory}/${name}.json`, 'utf8'))
    if (existing.matched && existing.seed === seed && existing.profile === profile && !!existing.trace === trace && !!existing.gpuTrace === gpuTrace && !!existing.nativeTrace === nativeTrace && !!existing.nativeContinuous === nativeContinuous) {
      if (profile) await access(`${directory}/${name}.cpuprofile.gz`)
      if (trace) await access(`${directory}/${name}.trace.json.gz`)
      console.log('SKIP', name); continue
    }
  } catch { /* Missing or incomplete runs must be measured. */ }
  const browser = await chromium.launch({ headless: true, args,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    await context.addInitScript(() => localStorage.setItem('blackout.renderQuality', 'balanced'))
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(String(error)))
    const session = await context.newCDPSession(page)
    if (profile) { await session.send('Profiler.enable'); await session.send('Profiler.setSamplingInterval', { interval: 1000 }); await session.send('Profiler.start') }
    if (nativeTrace) {
      await session.send('HeapProfiler.enable')
      await session.send('HeapProfiler.startSampling', { samplingInterval: 32768,
        includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
    }
    let traceCategories = 'devtools.timeline,v8,disabled-by-default-v8.compile,blink.user_timing'
    if (gpuTrace || nativeTrace) {
      const available = await session.send('Tracing.getCategories')
      const graphics = available.categories.filter(name => nativeTrace
        ? /^(gpu|viz|cc|benchmark|renderer.scheduler)$/.test(name)
        : /^(gpu|viz|cc|benchmark|renderer.scheduler|disabled-by-default-(gpu|viz))/.test(name))
      traceCategories += ',toplevel,' + graphics.join(',')
    }
    let tracing = false, traceSaved = false, bootSaved = false
    if (trace && (!gpuTrace || nativeTrace)) {
      await session.send('Tracing.start', { categories: traceCategories, transferMode: 'ReturnAsStream', ...(nativeTrace ? { traceBufferSizeInKb: 262144 } : {}) })
      tracing = true
    }
    if (profile) {
      if (trace) await page.addInitScript(() => { window.__hitchTrace = true })
      const snippet = readFileSync(new URL('./browser-stream-timings.js', import.meta.url), 'utf8')
      await page.addInitScript(snippet)
      for (const name of ['TerrainSystem', 'SettlementSystem', 'SurfaceDraper']) {
        await page.route(`**/src/world/${name}.ts*`, async route => {
          const response = await route.fetch()
          await route.fulfill({ response, body: `${await response.text()}\nwindow.__installStreamTimings('${name}', ${name}.prototype);` })
        })
      }
    }
    const sources = Object.fromEntries(execFileSync('rg', ['--files', 'src'], { encoding: 'utf8' }).trim().split('\n')
      .map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
    await writeFile(`${directory}/source-sha256.json`, JSON.stringify(sources, null, 2) + '\n')
    const saveTrace = async (suffix = '') => {
      const complete = new Promise(resolve => session.once('Tracing.tracingComplete', resolve))
      await session.send('Tracing.end')
      const { stream } = await complete
      // Native traces can exceed V8's single-string limit. Compress while
      // draining CDP, with backpressure and no complete timeline in memory.
      const compressor = createGzip()
      const completed = pipeline(compressor, createWriteStream(`${directory}/${name}${suffix}.trace.json.gz`))
      while (true) {
        const chunk = await session.send('IO.read', { handle: stream, size: 1048576 })
        const bytes = chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : Buffer.from(chunk.data)
        if (!compressor.write(bytes)) await once(compressor, 'drain')
        if (chunk.eof) break
      }
      compressor.end()
      await completed
      await session.send('IO.close', { handle: stream })
    }
    const started = Date.now()
    await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/?course=free-flight&seed=${seed}&review=flight&reviewFixedRatio=1&reviewRoute=${route}`)
    await page.locator('#flight-review button').waitFor({ timeout: 120000 })
    const gpu = await page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2')
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      return { vendor: gl.getParameter(info.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency, userAgent: navigator.userAgent }
    })
    if (/SwiftShader|llvmpipe/i.test(gpu.renderer)) throw new Error(`Software renderer: ${gpu.renderer}`)
    if (profile && !await page.evaluate(() => window.__streamTimings?.['terrain.buildChunk']
      && window.__streamTimings?.['settlement.update'] && window.__streamTimings?.['drape.update'])) {
      throw new Error('Diagnostic module timers were not installed')
    }
    await page.locator('#flight-review button').click()
    let result, previousSeconds = -1, stalled = 0
    while (Date.now() - started < 900000) {
      await page.waitForTimeout(10000)
      const raw = await page.locator('#flight-review pre').innerText()
      try { result = JSON.parse(raw) } catch { continue }
      console.log(stage, name, result.phase, result.seconds.toFixed(1), 's', result.streaming)
      if (nativeTrace && !nativeContinuous && tracing && !bootSaved && result.seconds >= 1) {
        await saveTrace('-boot'); tracing = false; bootSaved = true
      }
      if ((gpuTrace || nativeTrace) && trace && result.seconds >= (nativeTrace ? traceStart : 30) && !tracing && !traceSaved) {
        await session.send('Tracing.start', { categories: traceCategories, transferMode: 'ReturnAsStream', ...(nativeTrace ? { traceBufferSizeInKb: 262144 } : {}) })
        tracing = true
        await page.evaluate(() => performance.measure('review-clock-origin', { start: 0, end: performance.now() }))
      }
      if (!nativeContinuous && (gpuTrace || nativeTrace) && tracing && result.seconds >= (nativeTrace ? traceEnd : 50)) {
        await saveTrace(); tracing = false; traceSaved = true
      }
      if (result.phase === 'finished') break
      stalled = result.seconds === previousSeconds ? stalled + 1 : 0
      previousSeconds = result.seconds
      if (stalled >= 3) {
        await writeFile(`${directory}/${name}-failed.json`, JSON.stringify({ errors, ...result }, null, 2))
        await page.screenshot({ path: `${directory}/${name}-failed.png` })
        throw new Error(`Route stalled: ${name}. Inspect saved failure.`)
      }
    }
    if (!result || result.phase !== 'finished') throw new Error(`Route did not finish: ${name}`)
    const matched = result.seed === seed && result.quality === 'balanced' && result.ratioRange.every(value => value === 1)
      && result.viewport[0] === 1280 && result.viewport[1] === 720 && result.distanceM === 81600 && errors.length === 0
    if (profile && !await page.evaluate(() => window.__streamTimings['terrain.buildChunk'].calls > 0
      && window.__streamTimings['drape.update'].calls > 0)) throw new Error('Diagnostic timers recorded no work')
    const output = { stage, run, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      productionDiff: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }).trim(),
      streamTimings: profile ? await page.evaluate(() => window.__streamTimings) : undefined,
      instrumentation, browserVersion: browser.version(), args, gpu, profile, trace, gpuTrace, nativeTrace, nativeContinuous, traceCategories, matched, errors, ...result }
    await writeFile(`${directory}/${name}.json`, JSON.stringify(output, null, 2) + '\n')
    if (profile) {
      const { profile: cpu } = await session.send('Profiler.stop')
      await writeFile(`${directory}/${name}.cpuprofile.gz`, gzipSync(JSON.stringify(cpu)))
    }
    if (trace && !traceSaved) {
      if (!tracing) throw new Error('Trace window did not start')
      await saveTrace()
    }
    if (nativeTrace) {
      const { profile: allocations } = await session.send('HeapProfiler.stopSampling')
      await writeFile(`${directory}/${name}.heapprofile.gz`, gzipSync(JSON.stringify(allocations)))
      await session.send('HeapProfiler.collectGarbage')
      const heapAfterGC = await page.evaluate(() => performance.memory.usedJSHeapSize)
      await writeFile(`${directory}/${name}-post-gc.json`, JSON.stringify({ heapAfterGC,
        note: 'Diagnostic only, after flight and outside all acceptance metrics.' }, null, 2) + '\n')
    }
    if (process.env.REVIEW_CAPTURE === '1') await page.screenshot({ path: `${directory}/${name}.png` })
    if (!matched) throw new Error(`Unmatched result saved: ${name}`)
    console.log('SAVED', name, result.flightFrames, result.heapBytes)
  } finally { await browser.close() }
}
