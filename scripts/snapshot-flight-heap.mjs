// Diagnostic flight only. Heap snapshots collect garbage and are never acceptance runs.
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createWriteStream, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createGzip, gzipSync } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const routeId = process.env.HEAP_ROUTE || 'world'
if (!['world', 'city'].includes(routeId)) throw Error('HEAP_ROUTE must be world or city')
const directory = process.argv[2] || `docs/reviews/memory-10.931/${routeId}`
await mkdir(directory, { recursive: true })
const seed = routeId === 'city' ? 1337 : 73
const heapTargetBytes = Number(process.env.HEAP_TARGET_MB || 200) * 1000000
if (!Number.isFinite(heapTargetBytes) || heapTargetBytes <= 0) throw Error('Invalid heap target')
const allocationSampling = process.env.HEAP_SAMPLE_ALLOCATIONS === '1'
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--disable-vulkan-surface','--enable-precise-memory-info'] })
try {
  const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
  const errors = [], samples = []
  page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text())})
  page.on('pageerror', e => errors.push(String(e)))
  await page.addInitScript(() => { localStorage.setItem('blackout.renderQuality','balanced'); window.__memoryModules = {} })
  const caches = { Hydrology:['cache'], RegionalDrainage:['nodes'], SettlementPlan:['cache','anchorCache'], RiverSurface:['cache'], Landforms:[] }
  for (const [name, fields] of Object.entries(caches)) if (fields.length) {
    await page.route(`**/src/world/${name}.ts*`, async route => {
      const response = await route.fetch(), source = await response.text()
      const found = fields.filter(f => new RegExp(`(?:const|let) ${f} =`).test(source))
      await route.fulfill({response, body:source+`\nif (typeof window !== "undefined") window.__memoryModules.${name} = {${found.join(',')}};`})
    })
  }
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch(), source = await response.text(), anchor = 'const tick = (nowMs) => {'
    if (!source.includes(anchor)) throw Error('Missing main hook')
    const hook = `window.__memoryWorld = world;
window.__memoryInventory = () => {
 const seen = new Set(), groups = {}, geometries = new Set();
 const add = (category, array) => { if (!array?.buffer || seen.has(array.buffer)) return; seen.add(array.buffer); groups[category] = (groups[category] || 0) + array.buffer.byteLength };
 world.scene.traverse(o => { if (!o.geometry || geometries.has(o.geometry)) return; geometries.add(o.geometry); const category = o.name === 'TerrainChunk' ? 'terrain geometry' : o.name === 'WaterSurface' ? 'water geometry' : 'other geometry'; for (const a of Object.values(o.geometry.attributes)) add(category, a.array); add(category, o.geometry.index?.array) });
 for (const c of world.terrain.chunks.values()) { add('contact grids',c.heights); add('contact grids',c.waterLevels) }
 for (const s of world.settlements.draper?.surfaces || []) { add('drape staging',s.staged); add('drape owners',s.owners) }
 const maps = {}; for(const [name,m] of Object.entries(window.__memoryModules)) maps[name] = Object.fromEntries(Object.entries(m).map(([k,v])=>[k,v.size]));
 return {heap:performance.memory.usedJSHeapSize,groups,geometryCount:geometries.size,maps,terrain:world.terrain.streamingStats,settlements:{loaded:world.settlements.loaded.size,connections:world.settlements.connections.size},position:aircraft.position.toArray()};
};
window.__memoryArm = null; window.__memoryPeak = null;
window.__memoryFrame = () => {
 const arm = window.__memoryArm; if (!arm || flightReview?.phase !== 'flight') return;
 const heap = performance.memory.usedJSHeapSize, seconds = flightReview.seconds;
 if (seconds >= arm.seconds && heap >= arm.threshold) { window.__memoryPeak = {heap,seconds,at:performance.now()}; window.__memoryArm = null; menu.openPause(); }
};\n`
    await route.fulfill({response,body:source.replace(anchor,hook+anchor).replace('renderer.render(world.scene, cameras.camera);','renderer.render(world.scene, cameras.camera); window.__memoryFrame();')})
  })
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/?course=free-flight&seed=${seed}&review=flight&reviewFixedRatio=1&reviewRoute=${routeId}`)
  await page.locator('#flight-review button').waitFor({timeout:120000})
  await page.locator('#flight-review button').click()
  const session = await page.context().newCDPSession(page)
  await session.send('HeapProfiler.enable')
  if (allocationSampling) await session.send('HeapProfiler.startSampling',{samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true})
  const points = (process.env.HEAP_SECONDS || '5,60').split(',').map(Number)
  for (const seconds of points) {
    await page.evaluate(({seconds,threshold}) => { window.__memoryPeak=null;window.__memoryArm={seconds,threshold} }, {seconds,threshold:heapTargetBytes})
    await page.waitForFunction(() => { try { return window.__memoryPeak || JSON.parse(document.querySelector('#flight-review pre').textContent).phase === 'finished' } catch { return false } }, null, {timeout:360000})
    const peak = await page.evaluate(() => window.__memoryPeak)
    if (!peak) await page.keyboard.press('Escape')
    const before = await page.evaluate(() => window.__memoryInventory())
    const result = JSON.parse(await page.locator('#flight-review pre').innerText())
    if(before.terrain.workers!==4)throw Error('Diagnostic lost terrain workers')
    const compressor = createGzip(), completed = pipeline(compressor,createWriteStream(`${directory}/${routeId}-${seconds}.heapsnapshot.gz`))
    const onChunk = ({chunk}) => compressor.write(chunk)
    session.on('HeapProfiler.addHeapSnapshotChunk',onChunk)
    await session.send('HeapProfiler.takeHeapSnapshot',{reportProgress:false,captureNumericValue:true,exposeInternals:true})
    session.off('HeapProfiler.addHeapSnapshotChunk',onChunk);compressor.end();await completed
    const after = await page.evaluate(() => window.__memoryInventory())
    await page.screenshot({path:`${directory}/${routeId}-${seconds}.png`})
    samples.push({seconds,peak,result,before,after})
    await writeFile(`${directory}/inventory.json`,JSON.stringify({note:'Paused diagnostic snapshots force GC. A threshold capture is a high-water trigger, not proof of the absolute route maximum. A missing trigger captures route end instead. Excluded from acceptance flights.',routeId,seed,heapTargetBytes,allocationSampling,errors,samples},null,2)+'\n')
    console.log('SNAPSHOT',seconds,JSON.stringify(before),JSON.stringify(after))
    await page.keyboard.press('Escape')
    if(result.phase==='finished')break
  }
  if (allocationSampling) {
    const {profile:allocations}=await session.send('HeapProfiler.stopSampling')
    await writeFile(`${directory}/allocations.heapprofile.gz`,gzipSync(JSON.stringify(allocations)))
  }
  const sources = Object.fromEntries(execFileSync('rg',['--files','src'],{encoding:'utf8'}).trim().split('\n').map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
  await writeFile(`${directory}/source-sha256.json`,JSON.stringify(sources,null,2)+'\n')
  if(errors.length)throw Error(errors.join('\n'))
} finally { await browser.close() }
