// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright index.mjs.
// Example: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/profile-flight.mjs before
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const stage = process.argv[2] || 'before'
if (!/^[a-z0-9-]+$/.test(stage)) throw new Error('Invalid output label')
const directory = `docs/reviews/performance-10.914/${stage}`
await mkdir(directory, { recursive: true })
const args = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
  '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-precise-memory-info']
const routes = (process.env.REVIEW_ROUTES || 'city,world').split(',')
const repetitions = Number(process.env.REVIEW_RUNS || 3)
const profile = process.env.REVIEW_PROFILE === '1'
const instrumentation = Object.fromEntries(['src/debug/FlightReview.ts', 'src/core/AdaptiveResolution.ts'].map(path =>
  [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
for (let run = 1; run <= repetitions; run++) for (const route of routes) {
  const name = `${route}-${run}`
  const seed = route === 'world' ? 73 : 1337
  try {
    const existing = JSON.parse(await readFile(`${directory}/${name}.json`, 'utf8'))
    if (existing.matched && existing.seed === seed && existing.profile === profile) { console.log('SKIP', name); continue }
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
    if (profile) {
      const snippet = readFileSync(new URL('./browser-stream-timings.js', import.meta.url), 'utf8')
      await page.addInitScript(snippet)
      for (const name of ['TerrainSystem', 'SettlementSystem', 'SurfaceDraper']) {
        await page.route(`**/src/world/${name}.ts*`, async route => {
          const response = await route.fetch()
          await route.fulfill({ response, body: `${await response.text()}\nwindow.__installStreamTimings('${name}', ${name}.prototype);` })
        })
      }
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
      instrumentation, browserVersion: browser.version(), args, gpu, profile, matched, errors, ...result }
    await writeFile(`${directory}/${name}.json`, JSON.stringify(output, null, 2) + '\n')
    if (profile) {
      const { profile: cpu } = await session.send('Profiler.stop')
      await writeFile(`${directory}/${name}.cpuprofile.gz`, gzipSync(JSON.stringify(cpu)))
    }
    if (!matched) throw new Error(`Unmatched result saved: ${name}`)
    console.log('SAVED', name, result.flightFrames, result.heapBytes)
  } finally { await browser.close() }
}
