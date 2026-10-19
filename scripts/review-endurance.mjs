import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = process.argv[2] || 'docs/reviews/flights-10.930/before'
await mkdir(directory, { recursive: true })
const hook = await readFile(process.env.FLIGHT_HOOK || 'scripts/browser-endurance-review.js', 'utf8')
const seeds = (process.env.FLIGHT_SEEDS || '73,1337,2026').split(',').map(Number)
const servedSourceCommit = process.env.FLIGHT_SOURCE_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const duration = Number(process.env.FLIGHT_SECONDS || 620)
for (const seed of seeds) {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan',
      '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-precise-memory-info'] })
  const errors = [], samples = [], pictures = []
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    page.setDefaultTimeout(180000)
    page.on('pageerror', e => errors.push(String(e)))
    page.on('crash', () => errors.push('Browser page crashed'))
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await page.addInitScript(() => {
      localStorage.setItem('blackout.renderQuality', 'balanced')
      HTMLElement.prototype.requestFullscreen = async () => {}
    })
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch(); let source = await response.text()
      for (const anchor of ['const tick = (nowMs) => {', 'aircraft.step(dt, nowMs);'])
        if (!source.includes(anchor)) throw Error('Missing injection anchor: ' + anchor)
      source = source.replace(/const fixedReviewRatio = [^;]+;/, 'const fixedReviewRatio = 1;')
        .replace('const tick = (nowMs) => {', hook + '\nconst tick = (nowMs) => {')
        .replace('aircraft.step(dt, nowMs);', 'window.__endurance.before(dt);\naircraft.step(dt, nowMs);')
      await route.fulfill({ response, body: 'import {sampleTerrainSurfaceHeightFast as enduranceSurface} from "/src/world/terrainSample.ts";\n' + source })
    })
    await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5174'}/?course=free-flight&seed=${seed}`)
    await page.waitForFunction(() => window.__endurance)
    await page.locator('#btn-play').click(); await page.waitForTimeout(5000)
    await page.evaluate(() => window.__endurance.start())
    const started = Date.now(); let nextShot = 0, previous = -1, stalled = 0, state
    while (Date.now() - started < (duration * 3 + 180) * 1000) {
      await page.waitForTimeout(5000)
      state = await page.evaluate(() => window.__endurance.state()); samples.push(state)
      console.log(seed, state.seconds.toFixed(1), state.status, 'agl', state.agl.toFixed(0), state.weather.id)
      if (state.seconds >= nextShot) {
        const file = `${seed}-${nextShot}s.png`; await page.screenshot({ path: `${directory}/${file}` })
        pictures.push({ file, sample: samples.length - 1 }); nextShot += 60
      }
      await writeFile(`${directory}/${seed}.json`, JSON.stringify({ seed, duration, hookSha256: createHash('sha256').update(hook).digest('hex'),
        servedSourceCommit,
        method: 'One airborne reset, then controls only; real physics, collision, weather, streaming and HUD.',
        wallSeconds: (Date.now() - started) / 1000, errors, pictures, samples, final: state }, null, 2) + '\n')
      if (state.status === 'crashed' || state.onGround) throw Error('Flight hit ground: ' + seed)
      if (state.seconds >= duration) break
      stalled = state.seconds === previous ? stalled + 1 : 0; previous = state.seconds
      if (stalled >= 6) throw Error('Flight stalled: ' + seed)
    }
    if (state.seconds < duration || errors.length) throw Error('Incomplete or errored flight: ' + seed)
    console.log('SAVED', seed, state.seconds, pictures.length)
  } finally { await browser.close() }
}
