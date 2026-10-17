// Separate visual verification, run after all timing measurements.
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = 'docs/reviews/performance-10.914/views'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan',
    '--enable-features=Vulkan', '--disable-vulkan-surface'] })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const errors = [], views = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/dev/terrain.html?seed=1337&destination=city`)
  await page.locator('#road-tour').waitFor()
  await page.waitForTimeout(20000)
  await page.locator('#review-view').selectOption('chase')
  await page.locator('#road-height').fill('90')
  await page.locator('#road-tour').click()
  await page.waitForTimeout(2000)
  if (!(await page.locator('#road-status').innerText()).includes('km')) throw new Error('No loaded road available')
  await page.locator('#road-progress').evaluate(element => {
    element.value = '100'; element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForTimeout(10000)
  for (const view of ['chase', 'first']) {
    await page.locator('#review-view').selectOption(view)
    await page.waitForTimeout(2000)
    views.push({ view, road: await page.locator('#road-status').innerText(), stats: await page.locator('#stats').innerText() })
    await page.locator('nav').evaluate(element => element.style.visibility = 'hidden')
    await page.screenshot({ path: `${directory}/city-${view}.png` })
    await page.locator('nav').evaluate(element => element.style.visibility = '')
  }
  await writeFile(`${directory}/views.json`, JSON.stringify({ seed: 1337, viewport: [1280, 720], pixelRatio: 1,
    clearanceM: 90, progress: .1, errors, views }, null, 2) + '\n')
  if (errors.length) throw new Error(errors.join('\n'))
} finally { await browser.close() }
