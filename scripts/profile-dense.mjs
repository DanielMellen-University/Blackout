// Separate diagnostic scene, never pooled with full-game acceptance runs.
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const stage = process.argv[2] || 'dense-before'
if (!/^[a-z0-9-]+$/.test(stage)) throw new Error('Invalid output label')
const directory = `docs/reviews/performance-10.914/${stage}`
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan',
    '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-precise-memory-info'] })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  const session = await page.context().newCDPSession(page)
  await session.send('Profiler.enable'); await session.send('Profiler.setSamplingInterval', { interval: 1000 })
  await session.send('Profiler.start')
  await session.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.compile,blink.user_timing',
    transferMode: 'ReturnAsStream' })
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/dev/terrain.html?seed=1337&destination=city`)
  await page.locator('#place-view').waitFor()
  await page.waitForFunction(() => document.querySelector('#stats').textContent.includes('buildings'), undefined, { timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(20000)
  await page.evaluate(() => performance.mark('profile-city-loaded'))
  const { profile: cold } = await session.send('Profiler.stop')
  await writeFile(`${directory}/cold.cpuprofile.gz`, gzipSync(JSON.stringify(cold)))
  await page.locator('#place-view').click()
  await session.send('Profiler.start')
  await page.waitForTimeout(30000)
  await page.evaluate(() => performance.mark('profile-core-steady-end'))
  const { profile: cpu } = await session.send('Profiler.stop')
  const traceComplete = new Promise(resolve => session.once('Tracing.tracingComplete', resolve))
  await session.send('Tracing.end')
  const { stream } = await traceComplete
  let trace = ''
  while (true) {
    const chunk = await session.send('IO.read', { handle: stream })
    trace += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data
    if (chunk.eof) break
  }
  await session.send('IO.close', { handle: stream })
  await writeFile(`${directory}/timeline.json.gz`, gzipSync(trace))
  const allEvents = JSON.parse(trace).traceEvents
  const events = allEvents.filter(event => event.ph === 'X')
  const totals = new Map()
  for (const event of events) {
    const entry = totals.get(event.name) || { calls: 0, totalMs: 0, maxMs: 0 }
    entry.calls++; entry.totalMs += event.dur / 1000; entry.maxMs = Math.max(entry.maxMs, event.dur / 1000)
    totals.set(event.name, entry)
  }
  await writeFile(`${directory}/timeline-summary.json`, JSON.stringify({ threads: allEvents.filter(event => event.name === 'thread_name'),
    eventsByName: [...totals].sort((a, b) => b[1].maxMs - a[1].maxMs),
    longest: events.slice().sort((a,b) => b.dur-a.dur).slice(0,100).map(({name,cat,pid,tid,ts,dur})=>({name,cat,pid,tid,ts,dur})) }, null, 2) + '\n')
  await writeFile(`${directory}/dense.cpuprofile.gz`, gzipSync(JSON.stringify(cpu)))
  const result = await page.evaluate(() => ({ stats: document.querySelector('#stats').textContent, place: document.querySelector('#place-status').textContent,
    viewport: [innerWidth, innerHeight], devicePixelRatio, heap: performance.memory?.usedJSHeapSize }))
  await writeFile(`${directory}/dense.json`, JSON.stringify({ errors, browser: browser.version(), ...result }, null, 2) + '\n')
  await page.screenshot({ path: `${directory}/dense.png` })
  console.log(result)
} finally { await browser.close() }
