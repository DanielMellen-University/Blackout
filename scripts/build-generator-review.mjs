// Review-only build: production Vite mode, with controls/observer hooks injected.
// It never changes tracked source or the ordinary dist production build.
import { build } from 'vite'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const hook = await readFile('scripts/browser-nitro-b21.js', 'utf8')
const hookSha256 = createHash('sha256').update(hook).digest('hex')
const outDir = process.env.B21_DIST || '/tmp/blackout-generator-production'
await build({ build: { outDir, emptyOutDir: true }, plugins: [{
  name: 'external-b21-review', enforce: 'pre',
  transform(source, id) {
    if (!id.endsWith('/src/main.ts')) return
    for (const anchor of ['const tick = (nowMs: number): void => {', 'aircraft.step(dt, nowMs)', 'refillNitroAtGate(aircraft.nitro)', 'const touch = collision.check(aircraft)'])
      if (!source.includes(anchor)) throw Error('Review anchor missing: ' + anchor)
    return ('import { sampleTerrainSurfaceHeightFast as b21Ground } from \"./world/terrainSample\";\n' + source).replace('const tick = (nowMs: number): void => {', hook + `\nwindow.__training.buildId = '${hookSha256}';\n` + 'const tick = (nowMs: number): void => {')
      .replace('aircraft.step(dt, nowMs)', 'window.__training.before(dt); aircraft.step(dt, nowMs)')
      .replaceAll('refillNitroAtGate(aircraft.nitro)', 'window.__training.gateBefore(); refillNitroAtGate(aircraft.nitro); window.__training.gateAfter()')
      .replace('const touch = collision.check(aircraft)', 'const touch = collision.check(aircraft); window.__training.touch(touch)')
  },
}] })
await mkdir('docs/reviews/generator/hooks-build', { recursive: true })
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])))
await mkdir('docs/reviews/generator/hooks-build/hooks', { recursive: true })
await writeFile(`docs/reviews/generator/hooks-build/hooks/${hookSha256}.js`, hook)
const manifest = JSON.stringify({
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  production: true, mode: 'production', minified: true, sourceHashes,
  hookSha256,
  method: 'Production Vite build with external controls-only pilot and read-only observer injected before bundling. Normal dist is untouched. No physics, pose, velocity, gates, clock or results overrides.',
}, null, 2) + '\n'
await writeFile('docs/reviews/generator/hooks-build/browser-build.json', manifest)
await writeFile(`docs/reviews/generator/hooks-build/hooks/${hookSha256}.json`, manifest)
