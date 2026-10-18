import { mkdir, readFile, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = process.argv[2] || 'docs/reviews/flights-10.930', label = process.argv[3] || 'issues-before'
await mkdir(directory, { recursive: true })
const hook = await readFile('scripts/browser-flight-issues.js', 'utf8')
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] })
const results = [], errors = []
try {
  for (const [seed, target] of [[1337, 5], [73, 120], [73, 300]]) {
    const recorded = label !== 'issues-before' ? JSON.parse(await readFile(`${directory}/issues-before.json`, 'utf8')).results.find(r => r.seed === seed && r.target === target) : null
    const flight = recorded ? null : JSON.parse(await readFile(`${directory}/before/${seed}.json`, 'utf8'))
    const sample = recorded?.sample ?? flight.samples.reduce((a, b) => Math.abs(a.seconds - target) < Math.abs(b.seconds - target) ? a : b)
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    page.setDefaultTimeout(180000); page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error' && /shader|webglprogram/i.test(m.text())) errors.push(m.text()) })
    await page.addInitScript(() => { localStorage.setItem('blackout.renderQuality', 'balanced'); HTMLElement.prototype.requestFullscreen = async () => {} })
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch(); let source = await response.text()
      source = source.replace(/const fixedReviewRatio = [^;]+;/, 'const fixedReviewRatio = 1;')
        .replace('const tick = (nowMs) => {', hook + '\nconst tick = (nowMs) => {')
        .replace('aircraft.step(dt, nowMs);', 'window.__issues.before();\naircraft.step(dt, nowMs);')
      await route.fulfill({ response, body: 'import {timeOfDayForSeed as issueSeedTime} from "/src/world/WeatherDirector.ts";\nimport {sampleTerrainHeight as issueTerrain} from "/src/world/terrainSample.ts";\n' + source })
    })
    await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/?course=free-flight&seed=${seed}`)
    await page.waitForFunction(() => window.__issues)
    await page.locator('#btn-play').click(); await page.waitForTimeout(5000)
    await page.evaluate(s => window.__issues.place(s), sample)
    for (const seconds of seed === 1337 ? [5, 25] : [20]) {
      await page.waitForTimeout(seconds === 25 ? 20000 : seconds * 1000)
      const file = `${label}-${seed}-${target}-${seconds}.png`
      await page.screenshot({ path: `${directory}/${file}` })
      const scan = await page.evaluate(() => window.__issues.scan())
      results.push({ seed, target, seconds, sample, file, scan })
      console.log(file, 'gap', Math.max(...scan.cases.filter(c => c.visible).map(c => c.gap ?? 0)))
    }
    await page.close()
  }
} finally {
  await browser.close()
  await writeFile(`${directory}/${label}.json`, JSON.stringify({ results, errors }, null, 2) + '\n')
}
if (errors.length) throw Error(errors.join('\n'))
