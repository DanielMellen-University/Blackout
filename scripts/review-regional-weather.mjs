// Actual Free flight loop, audio graph and production cameras. Trajectories are
// prescribed; collision, weather, terrain streaming and resource limits run normally.
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = process.env.REVIEW_DIRECTORY || 'docs/reviews/weather-10.918'
await mkdir(directory, { recursive: true })
const cases = process.env.REVIEW_WEATHER_CASES?.split(',') || [
  'weather-loop', 'weatherfront-low', 'weatherfront-high', 'weatherstorm-low',
  'weatherstorm-high', 'weathersnow-low', 'weathersnow-high',
]
const args = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
  '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-precise-memory-info']
const sourceFiles = Object.fromEntries(['src/audio/FlightAudio.ts', 'src/main.ts', 'src/world/Atmosphere.ts',
  'src/world/RegionalWeather.ts', 'src/debug/FlightReview.ts', 'src/debug/WeatherReviewRoutes.ts',
  'src/world/RainField.ts', 'src/world/SnowField.ts', 'src/systems/StormBuffet.ts',
  'src/world/World.ts', 'src/aircraft/Aircraft.ts', 'src/camera/CameraSystem.ts'].map(path =>
    [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
const sourceHash = createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex')
for (const name of cases) {
  let saved
  try { saved = JSON.parse(await readFile(`${directory}/${name}.json`, 'utf8')) } catch { /* incomplete case */ }
  if (saved?.result.phase === 'finished' && saved.errors.length === 0) {
    if (saved.sourceHash !== sourceHash) throw Error('Review source changed; use a new REVIEW_DIRECTORY to retain both captures')
    console.log('SKIP', name); continue
  }
  const duration = name === 'weather-loop' ? 900 : 120
  const cockpit = name.includes('high') || name === 'weathersnow-low'
  const browser = await chromium.launch({ headless: true, args,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
  const errors = [], samples = [], pictures = []
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    await context.addInitScript(() => localStorage.setItem('blackout.renderQuality', 'balanced'))
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error' && /shader|webglprogram/i.test(m.text())) errors.push(m.text()) })
    // Read-only instance references in this browser. Fixed-argument wrappers
    // allocate no rest arrays, histories, nodes or world resources per frame.
    for (const [path, code] of [
      ['world/World', `const reviewUpdate=World.prototype.update; World.prototype.update=function(x,y,z,dt,simDt,visualDt){window.__weatherWorld=this;return reviewUpdate.call(this,x,y,z,dt,simDt,visualDt)}`],
      ['audio/FlightAudio', `const reviewAudio=FlightAudio.prototype.update; FlightAudio.prototype.update=function(opts){window.__weatherAudio=this;window.__weatherAudioFrame=opts;return reviewAudio.call(this,opts)}`],
      ['aircraft/Aircraft', `const reviewBuffet=Aircraft.prototype.setStormBuffet; Aircraft.prototype.setStormBuffet=function(value){window.__weatherJet=this;return reviewBuffet.call(this,value)}`],
      ['camera/CameraSystem', `const reviewCamera=CameraSystem.prototype.update; CameraSystem.prototype.update=function(jet,dt){window.__weatherCamera=this;return reviewCamera.call(this,jet,dt)}`],
    ]) await page.route(`**/src/${path}.ts*`, async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: `${await response.text()}\n${code}` })
    })
    await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/?course=free-flight&seed=1&review=flight&reviewFixedRatio=1&reviewRoute=${name}&reviewSeconds=${duration}&reviewCamera=${cockpit ? 'cockpit' : 'chase'}`)
    await page.locator('#flight-review button').waitFor({ timeout: 120000 })
    const gpu = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info')
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    })
    if (/SwiftShader|llvmpipe/i.test(gpu)) throw Error(`Software renderer ${gpu}`)
    await page.locator('#flight-review button').click()
    const captureAt = duration === 900 ? [30, 150, 330, 570, 810, 895] : [5, 25, 45, 65, 85, 115]
    const capturedExtremes = new Set()
    let result, previous = -1, stalled = 0, shot = 0
    const started = Date.now()
    while (Date.now() - started < (duration * 3 + 180) * 1000) {
      await page.waitForTimeout(5000)
      result = JSON.parse(await page.locator('#flight-review pre').innerText())
      if (!['flight','finished'].includes(result.phase)) continue
      const value = await page.evaluate(() => {
        const world=window.__weatherWorld, a=world.atmosphere, audio=window.__weatherAudio, jet=window.__weatherJet
        const weather={...a.weatherState}
        const pools=[a.rainField.mesh.geometry,a.snowField.points.geometry,a.rainShafts.mesh.geometry,
          ...Object.values(a.cloudInstances).map(v=>v.instanceMatrix),audio.stormSrc,audio.stormGain]
        window.__initialWeatherPools ??= pools
        const target = node => audio.scheduledTargets.get(node.gain) ?? 0
        return { position:jet.position.toArray(),status:jet.status,camera:window.__weatherCamera.mode,
          seconds:a.weatherSimulationTime,weather,precipitationVisibility:a.precipitationVisibility,
          layerExposure:a.stormExposure,buffet:jet.stormBuffet,
          fog:{near:world.scene.fog.near,far:world.scene.fog.far},
          rainVisible:a.rainField.mesh.visible,snowVisible:a.snowField.points.visible,
          cloudCapacity:Object.values(a.cloudInstances).map(v=>v.instanceMatrix.count),
          cloudDraws:Object.values(a.cloudInstances).map(v=>v.count),shaftCapacity:a.rainShafts.mesh.instanceMatrix.count,
          rainCapacity:a.rainField.mesh.geometry.getAttribute('position').count,
          snowCapacity:a.snowField.points.geometry.getAttribute('position').count,
          samePools:pools.every((v,i)=>v===window.__initialWeatherPools[i]),
          audio:{state:audio.ctx?.state,master:target(audio.master),wind:target(audio.windGain),
            rain:target(audio.precipGain),storm:target(audio.stormGain),
            rainInput:window.__weatherAudioFrame.rain,snowInput:window.__weatherAudioFrame.snow,
            stormInput:window.__weatherAudioFrame.weatherStorm,windMpsInput:window.__weatherAudioFrame.weatherWindMps,
            sharedBrownBuffer:audio.stormSrc.buffer===audio.engineSrc.buffer},
          heapBytes:performance.memory?.usedJSHeapSize??0,
          terrainRoots:document.querySelector('canvas')?world.terrain.root.children.length:0 }
      })
      samples.push({ flightSeconds:result.seconds, rendererGeometries:result.geometries, rendererTextures:result.textures, ...value })
      console.log(name,result.phase,result.seconds.toFixed(1),value.weather.id,
        'rain',value.weather.rain.toFixed(2),'snow',value.weather.snow.toFixed(2),
        'buffet',value.buffet.toFixed(2),'heap',(value.heapBytes/1e6).toFixed(1))
      if (process.env.REVIEW_CAPTURE_EXTREMES === '1' && ['fog','blizzard'].includes(value.weather.id) && !capturedExtremes.has(value.weather.id)) {
        capturedExtremes.add(value.weather.id)
        const file=`${name}-${value.weather.id}-${result.seconds.toFixed(1)}s.png`
        await page.locator('#flight-review').evaluate(el=>{el.style.visibility='hidden'})
        await page.screenshot({path:`${directory}/${file}`})
        await page.locator('#flight-review').evaluate(el=>{el.style.visibility=''})
        pictures.push({file,sample:samples.length-1})
      }
      if (shot < captureAt.length && result.seconds >= captureAt[shot]) {
        const file=`${name}-${captureAt[shot]}s.png`
        await page.locator('#flight-review').evaluate(el=>{el.style.visibility='hidden'})
        await page.screenshot({path:`${directory}/${file}`})
        await page.locator('#flight-review').evaluate(el=>{el.style.visibility=''})
        pictures.push({file,sample:samples.length-1});shot++
      }
      if (result.phase === 'finished') break
      stalled = result.seconds === previous ? stalled+1 : 0; previous=result.seconds
      if (stalled>=4 || value.status==='crashed') throw Error(`Weather route stopped at ${result.seconds}s (${value.status})`)
    }
    if (result?.phase!=='finished') throw Error('Weather flight did not complete')
    if (errors.length || samples.some(s=>!s.samePools || s.cloudCapacity.reduce((a,b)=>a+b,0)!==688 || s.shaftCapacity!==16)) throw Error('Weather resource/error acceptance failed')
    if (samples.some(s=>s.camera!==(cockpit?'cockpit':'chase') || s.audio.state!=='running' || !s.audio.sharedBrownBuffer)) throw Error('Camera/audio graph mismatch')
    if (name.includes('high') && samples.some(s=>s.precipitationVisibility!==0 || s.layerExposure!==0 || s.audio.rain>0 || s.audio.storm>0 || s.buffet>0)) throw Error('Weather remains active above the deck')
    await writeFile(`${directory}/${name}.json`,JSON.stringify({sourceHash,sourceFiles,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      browser:browser.version(),args,gpu,seed:1,camera:cockpit?'cockpit':'chase',duration,errors,pictures,samples,result},null,2)+'\n')
  } catch(error) {
    await writeFile(`${directory}/${name}-failed.json`,JSON.stringify({errors,error:String(error),samples,pictures},null,2)+'\n')
    throw error
  } finally { await browser.close() }
}
