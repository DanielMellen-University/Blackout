// M4 production-build review: a controls-only pilot completes a gated run.
// The review hook is injected into a temporary build and is not shipped.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { build, preview } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/blackout-b32-tools/node_modules/playwright/index.mjs')
const dir = `${process.env.HOME}/codex-runs/m4`
await mkdir(dir, { recursive: true })
const sourcePaths = ['src/main.ts', 'src/systems/ChallengeRun.ts', 'src/core/Version.ts', 'src/core/FlightRevision.ts', 'src/systems/CourseLibrary.ts', 'src/ui/RunResults.ts']
const hashes = () => Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')]))
const sourceHashes = Object.fromEntries(await hashes())
const pilot = (await readFile('scripts/browser-generator.js', 'utf8')).split('window.__training.catalog=')[0]
const hook = `if(new URLSearchParams(location.search).get('dev')==='d1') {
${pilot}
const nativeShow=results.show.bind(results);
results.show=(...args)=>{
 nativeShow(...args);
 document.querySelector('#run-results').style.visibility='hidden';
};
window.__d1={start:()=>window.__training.start(),state:()=>({...window.__training.state(),
 recordId:activeSortie.recordId,elapsed:challenge.elapsedSec,landingPreview:hudFrame.landingPreview,
 navTarget:hudFrame.navTarget,banner:hudFrame.banner,
 report:document.querySelector('#run-results').innerText,
 storage:{...localStorage}})};
}`
const outDir = '/tmp/blackout-m4-production'
await build({ build: { outDir, emptyOutDir: true }, plugins: [{
  name: 'd1-external-review', enforce: 'pre', transform(source, id) {
    if (!id.endsWith('/src/main.ts')) return
    for (const anchor of ['const tick = (nowMs: number): void => {', 'aircraft.step(dt, nowMs)']) assert.ok(source.includes(anchor), anchor)
    return ('import { sampleTerrainSurfaceHeightFast as b21Ground } from "./world/terrainSample";\n' + source)
      .replace('const tick = (nowMs: number): void => {', hook + '\nconst tick = (nowMs: number): void => {')
      .replace('aircraft.step(dt, nowMs)', 'window.__training?.before(dt); aircraft.step(dt, nowMs)')
  },
}] })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 5199, strictPort: true } })
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] })
const errors = [], samples = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(120000)
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && /shader|webglprogram/i.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('blackout.renderQuality', 'balanced'); HTMLElement.prototype.requestFullscreen = async () => {} })
  await page.goto('http://127.0.0.1:5199/?dev=d1&course=training-orbit&seed=67')
  await page.waitForFunction(() => window.__d1)
  await page.locator('#startup-screen').waitFor({ state: 'hidden' })
  await page.locator('#btn-play').click()
  await page.locator('#startup-screen').waitFor({ state: 'hidden' })
  const recordId = await page.evaluate(() => window.__d1.state().recordId)
  assert.ok(recordId.includes(':s1'))
  const oldRecordId = recordId.replace(':s1', '')
  await page.evaluate(id => localStorage.setItem(`blackout.best.${id}`, '98765'), oldRecordId)
  await page.evaluate(() => window.__d1.start())
  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(1000)
    const state = await page.evaluate(() => window.__d1.state())
    samples.push({ seconds: state.seconds, next: state.next, total: state.total, phase: state.phase, agl: state.agl, navTarget: state.navTarget, landingPreview: state.landingPreview })
    if (i % 15 === 0) console.log(JSON.stringify(samples.at(-1)))
    assert.notEqual(state.status, 'crashed', 'Controls pilot crashed')
    assert.notEqual(state.phase, 'returning')
    assert.notEqual(state.navTarget, 'base')
    assert.equal(state.landingPreview, null)
    if (state.resultsOpen) break
  }
  const final = await page.evaluate(() => window.__d1.state())
  assert.equal(final.phase, 'complete')
  assert.equal(final.next, final.total)
  assert.equal(final.onGround, false)
  assert.equal(final.status, 'ok')
  assert.ok(final.agl > 20)
  assert.equal(final.result.gateSplits.at(-1), final.result.elapsedSec)
  const bonus = final.result.flyingBonuses
  assert.ok(bonus && bonus.lowScore > 0 && bonus.speedScore > 0)
  assert.equal(final.result.totalScore, final.result.timeScore + bonus.lowScore + bonus.terrainScore + bonus.speedScore)
  assert.equal(final.storage[`blackout.best.${oldRecordId}`], '98765')
  assert.equal(final.storage[`blackout.best.${recordId}`], String(final.result.totalScore))
  assert.equal(final.result.landingScore, 0)
  for (const term of ['approachScore', 'weatherScore', 'nightScore', 'deadstickScore']) assert.ok(!final.result[term])
  assert.equal(final.result.gatesCleared, final.total)
  assert.ok(!/RETURN.*LAND|RETURN TO BASE/.test(final.banner || ''))
  await page.screenshot({ path: `${dir}/m4-final-gate.png` })
  await page.locator('#run-results').evaluate(el => { el.style.visibility = '' })
  await page.locator('.report-records summary').click()
  const scoreDetail = await page.locator('#result-score-detail').innerText()
  for (const label of ['LOW +', 'TERRAIN +', 'SPEED +']) assert.ok(scoreDetail.includes(label), label)
  await page.locator('#result-score-detail').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${dir}/m4-results.png` })
  await page.waitForTimeout(250)
  const frozen = await page.evaluate(() => window.__d1.state())
  assert.deepEqual(frozen.position, final.position)
  assert.equal(frozen.elapsed, final.elapsed)
  assert.deepEqual(errors, [])
  assert.deepEqual(Object.fromEntries(await hashes()), sourceHashes, 'Review source changed during flight')
  await writeFile(`${dir}/m4-flight.json`, JSON.stringify({ method: 'Production build on 5199, ordinary launch and controls-only pilot, with preserved prior score and new score checked. The already-open panel is hidden only for the unobstructed finish screenshot.', sourceHashes, errors, samples, final }, null, 2) + '\n')
  console.log(JSON.stringify({ pass: true, elapsed: final.result.elapsedSec, gates: final.total, agl: final.agl, score: final.result.totalScore, medal: final.result.medal, screenshots: [`${dir}/m4-final-gate.png`, `${dir}/m4-results.png`] }))
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
