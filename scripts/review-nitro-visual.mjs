import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dir = process.argv[2] || 'docs/reviews/nitro-b21/hud'
await mkdir(dir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const page = await context.newPage(), errors = [], shots = []
page.on('pageerror', e => errors.push(String(e)))
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('blackout.renderQuality', 'balanced'); HTMLElement.prototype.requestFullscreen = async () => {} })
const capture = async name => {
 await page.evaluate(() => window.__training.capture())
 const state = await page.evaluate(() => window.__training.state())
 const hud = await page.locator('#nitro-panel').evaluate(el => ({ text: el.textContent, box: el.getBoundingClientRect().toJSON(), boosting: el.classList.contains('boost'), refill: el.classList.contains('gate-refill'), value: el.querySelector('[role=meter]').getAttribute('aria-valuenow') }))
 await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 90 })
 shots.push({ name, state, hud })
}
try {
 await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5176'}/?course=training-orbit`)
 await page.waitForFunction(() => window.__training)
 await page.locator('#startup-screen').waitFor({ state: 'hidden' })
 await page.locator('#btn-play').click()
 await page.locator('#startup-screen').waitFor({ state: 'hidden' })
 await page.evaluate(() => window.__training.start())
 await capture('full')
 await page.waitForFunction(() => window.__training.state().agl > 50)
 if (process.env.B21_CAPTURE_AUDIO === '1') await page.evaluate(() => window.__training.startAudio())
 await page.evaluate(() => window.__training.boost(true))
 await page.waitForTimeout(1500)
 await capture('boost-chase')
 await page.evaluate(() => window.__training.camera('cockpit'))
 await page.waitForTimeout(350)
 await capture('boost-cockpit')
 await page.evaluate(() => { window.__training.boost(false); window.__training.camera('chase') })
 await page.waitForFunction(() => document.getElementById('nitro-panel').classList.contains('gate-refill'), { timeout: 180000 })
 await capture('gate-refill')
 await page.waitForTimeout(750)
 await capture('refill-settled')
 if (process.env.B21_CAPTURE_AUDIO === '1') {
  const encoded = await page.evaluate(() => window.__training.endAudio())
  await writeFile(`${dir}/boost-sound.webm`, Buffer.from(encoded, 'base64'))
 }
 const buildId = await page.evaluate(() => window.__training.buildId)
 const build = JSON.parse(await readFile(`docs/reviews/nitro-b21/hooks/${buildId}.json`, 'utf8'))
 await writeFile(`${dir}/review.json`, JSON.stringify({ build, errors, shots }, null, 2) + '\n')
 assert.deepEqual(errors, [])
 assert.equal(shots[1].hud.boosting, true)
 assert.ok(shots[1].state.nitro.fraction < 1)
 assert.equal(shots[3].hud.refill, true)
 assert.equal(shots[4].hud.refill, false)
 console.log(JSON.stringify(shots.map(s => ({ name: s.name, nitro: s.state.nitro, hud: s.hud })), null, 2))
} finally { await browser.close() }
