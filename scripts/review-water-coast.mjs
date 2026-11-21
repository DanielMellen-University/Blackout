// Development terrain stills using the existing destination scene and review camera.
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const label = process.argv[2] || 'before'
const destination = process.env.REVIEW_DESTINATION || 'ocean'
const seed = Number(process.env.REVIEW_SEED || 1)
const directory = process.env.REVIEW_DIRECTORY || 'docs/reviews/water-11.045'
await mkdir(directory, { recursive: true })
const args = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan',
  '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-precise-memory-info']
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => { errors.push(String(e)); console.error(e) })
  await page.route('**/dev/terrain.html?html-proxy*', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()) + '\nwindow.__waterReview={world,camera,controls,renderer};' })
  })
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5186'}/dev/terrain.html?destination=${destination}&seed=${seed}`)
  await page.waitForFunction(() => window.__waterReview)
  await page.locator('#weather').selectOption('clear')
  const pose = await page.evaluate(() => {
    const { camera, controls } = window.__waterReview
    const target = controls.target.clone()
    camera.position.set(target.x + 1000, 9000, target.z - 5000)
    controls.update()
    return { position: camera.position.toArray(), target: target.toArray() }
  })
  await page.waitForTimeout(Number(process.env.REVIEW_SETTLE_MS || 45000))
  const result = await page.evaluate(() => {
    const { world, renderer } = window.__waterReview
    const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info')
    return { streaming: world.terrain.streamingStats, renderer: gl.getParameter(e.UNMASKED_RENDERER_WEBGL),
      stats: document.querySelector('#stats').textContent }
  })
  await page.locator('nav').evaluate(e => e.style.visibility = 'hidden')
  await page.screenshot({ path: `${directory}/${label}-${destination}-seed-${seed}-9000m.png` })
  await writeFile(`${directory}/${label}-${destination}-seed-${seed}.json`, JSON.stringify({ label, seed, destination, pose, args, errors, ...result }, null, 2) + '\n')
  console.log(JSON.stringify({ label, destination, pose, errors, ...result }))
} finally { await browser.close() }
if (errors.length) throw Error(errors.join('\n'))
