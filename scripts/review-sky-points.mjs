import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const directory = process.argv[2] || 'docs/reviews/flights-10.930', label = process.argv[3] || 'sky-before'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.route('**/sky-review.html', route => route.fulfill({ contentType: 'text/html', body: `
    <style>body{margin:0;background:black}canvas{display:block}</style><script type="module">
    import * as T from '/node_modules/.vite/deps/three.js';
    import {SkyDome} from '/src/world/SkyDome.ts';
    const scene=new T.Scene(), sky=new SkyDome(scene);
    const camera=new T.PerspectiveCamera(60,1280/720,.1,100000);
    camera.lookAt(0,5000,10000);
    sky.update(0,0,0,new T.Vector3(0,-1,0),0,0,new T.Color(0),new T.Color(0),0,
      {broken:0,blanket:0,cirrus:0,storm:0,darkness:0,windX:0,windZ:0},30);
    const u=sky.mesh.material.uniforms;
    u.uMoonIntensity.value=0;u.uSunIntensity.value=0;u.uAurora.value=0;u.uStarIntensity.value=1;
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,720);renderer.setPixelRatio(1);
    document.body.append(renderer.domElement);renderer.render(scene,camera);window.__skyReady=true;
    </script>` }))
  await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:5173'}/sky-review.html`)
  await page.waitForFunction(() => window.__skyReady, null, { timeout: 30000 })
  await page.screenshot({ path: `${directory}/${label}.png` })
} finally {
  await browser.close()
  await writeFile(`${directory}/${label}.json`, JSON.stringify({ viewport: [1280, 720], pixelRatio: 1,
    method: 'Isolated actual SkyDome star shader, black background, no cloud/sun/moon/aurora.', errors }, null, 2) + '\n')
}
if (errors.length) throw Error(errors.join('\n'))
