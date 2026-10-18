import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = process.argv[2] || 'docs/reviews/shores-10.929', label = process.argv[3] || 'before'
await mkdir(directory, { recursive: true })
const prior = JSON.parse(await readFile('docs/reviews/terrain-10.923/after.json', 'utf8'))
const hook = await readFile('scripts/browser-shore-review.js', 'utf8')
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] })
const results = [], errors = []
try {
  for (const seed of (process.env.SHORE_SEEDS || '2026,9001').split(',').map(Number)) {
    const p = prior.results.find(r => r.seed === seed && r.kind === 'coast' && r.mode === 'chase')
    const pose = { ...p.coast, yaw: p.yaw }
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    page.setDefaultTimeout(180000); page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error' && /shader|webglprogram/i.test(m.text())) errors.push(m.text()) })
    await page.route('**/dev/terrain.html*', async route => {
      const response = await route.fetch(), source = await response.text()
      await route.fulfill({ response, body: route.request().url().includes('html-proxy')
        ? 'import {terrainEdgeJoin as shoreJoin} from "/src/world/TerrainSeams.ts";\n' + source + '\n' + hook : source })
    })
    await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/dev/terrain.html?seed=${seed}&destination=village`)
    await page.waitForFunction(() => window.__shore)
    await page.selectOption('#weather', 'clear')
    await page.evaluate(p => window.__shore.place(p), pose); await page.waitForTimeout(25000)
    for (const mode of ['chase', 'cockpit']) {
      await page.evaluate(({ pose, mode }) => window.__shore.pose(pose, mode), { pose, mode })
      await page.waitForTimeout(15000)
      const scan = await page.evaluate(() => window.__shore.scan())
      const file = `${label}-${seed}-${mode}.png`
      await page.locator('nav').evaluate(el => { el.style.visibility = 'hidden' })
      await page.screenshot({ path: `${directory}/${file}` })
      results.push({ seed, pose, mode, file, scan }); console.log('SAVED', file, scan.count)
    }
    await page.close()
  }
} finally {
  await browser.close()
  await writeFile(`${directory}/${label}.json`, JSON.stringify({ hookSha256: createHash('sha256').update(hook).digest('hex'), results, errors }, null, 2) + '\n')
}
if (errors.length) throw Error(errors.join('\n'))
