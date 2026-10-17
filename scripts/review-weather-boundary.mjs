// Real chase/cockpit cameras, continuous maximum-speed travel, 150 m AGL.
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = 'docs/reviews/weather-10.916'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan',
    '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-precise-memory-info'] })
const records = [], errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error' && /shader|webglprogram/i.test(message.text())) errors.push(message.text()) })
  // Read-only telemetry in this review browser, with no production debug global.
  await page.route('**/dev/terrain.html*', async route => {
    const response = await route.fetch()
    let html = await response.text()
    html = html.replace('const world=new World()', `import { stormBuffetDrive } from "/src/systems/StormBuffet.ts"
const world=new World()
window.__readWeatherBoundary=()=>{
  const weather={...world.atmosphere.weatherSnapshot}
  return {seed:getWorldSeed(),weather,time:world.atmosphere.weatherSimulationTime,
    position:reviewJet.position.toArray(),camera:chase.mode,fov:chase.camera.fov,
    fog:{near:world.scene.fog.near,far:world.scene.fog.far},sun:world.sun.intensity,
    buffet:stormBuffetDrive(weather.rain,weather.snow,weather.gust,{playing:true,paused:false,crashed:false,reducedMotion:false}),
    clouds:['cumulus','stratus','cirrus'].map(layer=>world.scene.getObjectByName('CloudBatch-'+layer).instanceMatrix.count),
    cloudDrawCounts:['cumulus','stratus','cirrus'].map(layer=>world.scene.getObjectByName('CloudBatch-'+layer).count),
    rainShaftCapacity:world.scene.getObjectByName('RainShafts').instanceMatrix.count,
    draws:renderer.info.render.calls,geometries:renderer.info.memory.geometries}
}`)
    await route.fulfill({ response, body: html })
  })
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/dev/terrain.html?seed=1&destination=weatherfront`)
  await page.waitForFunction(() => window.__readWeatherBoundary && document.querySelector('#stats').textContent.includes('tiles'), undefined, { timeout: 120000 })
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info')
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
  })
  if (/SwiftShader|llvmpipe/i.test(gpu)) throw Error(`Software renderer: ${gpu}`)
  for (const mode of ['chase', 'first']) {
    await page.locator('#review-view').selectOption(mode)
    await page.locator('#weather-height').evaluate(element => { element.value = '150'; element.dispatchEvent(new Event('input', { bubbles: true })) })
    await page.locator('#weather-fixture').evaluate(element => { element.open = true })
    for (const [id,value] of [['seed','1'],['x','-240000'],['z','-192000'],['time','180'],['day','.48']])
      await page.locator(`#fixture-${id}`).fill(value)
    await page.locator('#fixture-hold').uncheck()
    await page.locator('#fixture-apply').click()
    await page.waitForTimeout(5000)
    await page.locator('#fly').click()
    for (const km of [.5, 14, 27.5]) {
      await page.waitForFunction(target => {
        const match = document.querySelector('#travel-stats').textContent.match(/s \/ ([\d.]+) km/)
        return match && Number(match[1]) >= target
      }, km, { timeout: 120000, polling: 500 })
      const telemetry = await page.evaluate(() => window.__readWeatherBoundary())
      const ui = await page.locator('#stats').innerText(), travel = await page.locator('#travel-stats').innerText()
      const file = `${mode}-${km}km.png`
      await page.locator('nav').evaluate(element => { element.style.visibility = 'hidden' })
      await page.screenshot({ path: `${directory}/${file}` })
      await page.locator('nav').evaluate(element => { element.style.visibility = '' })
      records.push({ file, requestedMode: mode, agl: 150, gpu, ui, travel, ...telemetry })
    }
    await page.locator('#fly').click()
  }
  await writeFile(`${directory}/boundary.json`, JSON.stringify({ browser: browser.version(), errors, records }, null, 2) + '\n')
  if (errors.length) throw Error(errors.join('\n'))
  for (const mode of ['chase','first']) {
    const views = records.filter(r => r.requestedMode === mode)
    if (views.some(r => r.camera !== (mode === 'first' ? 'cockpit' : 'chase'))) throw Error('Review camera mismatch')
    if (views[0].weather.rain + views[0].weather.snow >= .05 || views.at(-1).weather.rain <= .22)
      throw Error(`The ${mode} flight did not cross the expected dry/rain boundary`)
    if (views.some(r => r.clouds.reduce((a,b)=>a+b,0)!==688 || r.rainShaftCapacity!==16)) throw Error('Weather capacity changed')
  }
  console.log(records.map(r => ({ file:r.file, id:r.weather.id, rain:r.weather.rain, wind:[r.weather.windX,r.weather.windZ], buffet:r.buffet })))
} finally { await browser.close() }
