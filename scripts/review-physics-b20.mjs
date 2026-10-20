import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dir = process.argv[2] || 'docs/reviews/physics-b20/browser'
const courses = (process.env.B20_COURSE_FILE ? await readFile(process.env.B20_COURSE_FILE, 'utf8') : process.env.B20_COURSES || 'training-orbit,contour-circuit,weather-approach,daily-ops,random').trim().split(',')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] })
await mkdir(dir, { recursive: true })
const outcomes = []
try {
  for (const course of courses) {
    const runDir = `${dir}/${course}`
    await mkdir(runDir, { recursive: true })
    if (process.env.B20_RESUME === '1') {
      try { const previous = JSON.parse(await readFile(`${runDir}/run.json`, 'utf8')); if (previous.pass) { outcomes.push({ course, pass: true, resumed: true }); continue } } catch {}
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, permissions: ['local-network-access'] })
    const wallStarted=Date.now()
    const page = await context.newPage(), errors = [], knownFallback = [], samples = [], pictures = []
    const reverseApproach=process.env.B20_REVERSE_APPROACH==='1'
    const renderIntervalMs=Number(process.env.B20_RENDER_INTERVAL||0)
    let final = null, pass = false, build = null
    page.setDefaultTimeout(120000)
    page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') { if (m.location().url.endsWith('/models/f35.glb')) knownFallback.push({ text: m.text(), url: m.location().url }); else errors.push(m.text()) } })
    await page.route('**/favicon.ico', r => r.fulfill({ status: 204, body: '' }))
    await page.addInitScript(reverse => { window.__b20ReverseApproach=reverse; localStorage.clear(); localStorage.setItem('blackout.renderQuality', 'balanced'); HTMLElement.prototype.requestFullscreen = async () => {} },reverseApproach)
    const save = () => writeFile(`${runDir}/run.json`, JSON.stringify({ course, reverseApproach, wallSeconds:(Date.now()-wallStarted)/1000, virtualTime: false, renderIntervalMs, method: 'DOM launch from runway, controls only, production Vite build. No pose, velocity, gate, clock or completion writes. Every accepted run uses normal browser wall time.', build, errors, knownFallback, pictures, samples, final, pass }, null, 2) + '\n')
    try {
      const seed = process.env.B20_SEED || (course === 'random' ? '42' : '')
      const period = course === 'weekly-ops' ? '&week=2026-W43' : course === 'monthly-ops' ? '&month=2026-10' : ''
      await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5175'}/?course=${course}${seed ? '&seed=' + seed : ''}${period}`)
      await page.waitForFunction(() => window.__training)
      const buildId = await page.evaluate(() => window.__training.buildId)
      build = buildId ? JSON.parse(await readFile(`docs/reviews/physics-b20/hooks/${buildId}.json`, 'utf8')) : null
      const catalog = await page.evaluate(() => window.__training.catalog())
      await writeFile(`${dir}/catalog.json`, JSON.stringify(catalog, null, 2) + '\n')
      await page.locator('#startup-screen').waitFor({ state: 'hidden' })
      const option = page.locator(`#title-course-picker [role=radio][data-course-id="${course}"]`)
      if (await option.count()) await option.click()
      await page.evaluate(()=>window.__training.capture?.()); await page.screenshot({ path: `${runDir}/launch.jpg`, type: 'jpeg', quality: 85 }); pictures.push('launch.jpg')
      await page.locator('#btn-play').click()
      await page.locator('#startup-screen').waitFor({ state: 'hidden' })
      await page.evaluate(interval => { window.__training.setRenderInterval?.(interval); window.__training.start() },renderIntervalMs)
      let gateShot = false, approachShot = false, lastLog = -10, lastFreeStage = ''
      const started = Date.now()
      while (Date.now() - started < Number(process.env.B20_MAX_WALL || 900) * 1000) {
        await page.waitForTimeout(1000)
        final = await page.evaluate(() => window.__training.state())
        assert.equal(final.course, course)
        if (final.seconds > Number(process.env.B20_MAX_SIM || 800)) break
        samples.push({ seconds: final.seconds, stage: final.stage, next: final.next, phase: final.phase, position: final.position, velocity: final.velocity,
          speed: final.speed, agl: final.agl, status: final.status, onGround: final.onGround, loadFactor: final.loadFactor, controls: final.controls, attitude: final.attitude })
        if (final.seconds >= lastLog + 15) { console.log(course, final.seconds.toFixed(1), final.stage, final.next, final.status, final.agl.toFixed(1), final.speed.toFixed(1)); lastLog = final.seconds }
        if (!gateShot && final.next >= 1 && final.status === 'ok') {
          await page.evaluate(()=>window.__training.capture?.()); await page.screenshot({ path: `${runDir}/gates.jpg`, type: 'jpeg', quality: 85 }); pictures.push('gates.jpg'); gateShot = true
        }
        if (!approachShot && final.stage === 'approach' && final.agl < 80 && final.agl > 8) {
          await page.evaluate(() => window.__training.camera('cockpit')); await page.waitForTimeout(200)
          await page.evaluate(()=>window.__training.capture?.()); await page.screenshot({ path: `${runDir}/approach-cockpit.jpg`, type: 'jpeg', quality: 85 }); pictures.push('approach-cockpit.jpg')
          await page.evaluate(() => window.__training.camera('chase')); approachShot = true
        }
        if (course === 'free-flight' && final.stage !== lastFreeStage) {
          const file = `${Math.round(final.seconds)}-${final.stage}.jpg`
          await page.evaluate(()=>window.__training.capture?.()); await page.screenshot({ path: `${runDir}/${file}`, type: 'jpeg', quality: 88 }); pictures.push(file); lastFreeStage = final.stage
        }
        await save()
        if (final.resultsOpen || final.status === 'crashed' || (course === 'free-flight' && final.onGround && final.speed < .1 && final.stage === 'rollout')) break
      }
      pass = errors.length === 0 && (course === 'free-flight' ? final.status !== 'crashed' && final.onGround && final.speed < .1 && !final.resultsOpen && !final.result && final.freeStages.some(s => s.stage === 'stall-recovery') : final.status === 'landed' && final.phase === 'complete' && final.next === final.gates.length && final.resultsOpen)
      if (course === 'free-flight') pass &&= !!final.contact && Math.abs(final.contact.localX) < 9 && Math.abs(final.contact.localZ) < 60
      await page.evaluate(()=>window.__training.capture?.()); await page.screenshot({ path: `${runDir}/${pass ? 'complete' : 'failure'}.jpg`, type: 'jpeg', quality: 88 }); pictures.push(`${pass ? 'complete' : 'failure'}.jpg`)
      await save()
      outcomes.push({ course, pass, seconds: final.seconds, next: final.next, status: final.status, errors })
      console.log('RESULT', JSON.stringify(outcomes.at(-1)))
    } catch (error) {
      errors.push(String(error)); await save(); outcomes.push({ course, pass: false, errors }); console.error(course, String(error))
    } finally { await context.close(); await writeFile(`${dir}/summary-${process.env.B20_BATCH||'main'}.json`, JSON.stringify(outcomes, null, 2) + '\n') }
    if (!pass && process.env.B20_CONTINUE !== '1') break
  }
} finally { await browser.close() }
assert.ok(outcomes.length === courses.length && outcomes.every(run => run.pass), 'Some browser flights remain incomplete; see saved runs')
