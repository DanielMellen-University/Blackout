import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const directory = process.argv[2] || 'docs/reviews/flights-10.930'
const results = []
for (const seed of [73, 1337, 2026]) {
  const flight = JSON.parse(await readFile(`${directory}/before/${seed}.json`, 'utf8'))
  if (flight.final.seconds < 600 || flight.wallSeconds < 600 || flight.errors.length || flight.pictures.length !== 11)
    throw Error(`Incomplete ten-minute evidence for ${seed}`)
  const hook = `${directory}/hooks/${seed}.js`
  if (createHash('sha256').update(await readFile(hook)).digest('hex') !== flight.hookSha256)
    throw Error(`Pilot hash mismatch for ${seed}`)
  for (const [i, picture] of flight.pictures.entries()) {
    const seconds = flight.samples[picture.sample].seconds
    if (!picture.file.endsWith(`-${i * 60}s.png`) || seconds < i * 60 || seconds > i * 60 + 12)
      throw Error(`Minute cadence mismatch for ${seed}: ${picture.file}`)
    const png = await readFile(`${directory}/before/${picture.file}`)
    if (png.readUInt32BE(16) !== 1280 || png.readUInt32BE(20) !== 720) throw Error('Viewport mismatch')
  }
  if (flight.samples.some(s => s.course !== 'free-flight' || s.seed !== seed || s.ratio !== 1 || s.paused || !s.playing))
    throw Error(`Runtime context mismatch for ${seed}`)
  let distanceM = 0
  for (let i = 1; i < flight.samples.length; i++)
    distanceM += Math.hypot(...flight.samples[i].position.map((v, j) => v - flight.samples[i - 1].position[j]))
  results.push({ seed, seconds: flight.final.seconds, wallSeconds: flight.wallSeconds, stills: flight.pictures.length,
    finalStatus: flight.final.status, sampledDistanceM: distanceM,
    weather: [...new Set(flight.samples.map(s => s.weather.id))], errors: flight.errors })
}
await writeFile(`${directory}/summary.json`, JSON.stringify({
  servedSourceCommit: 'cb51f2f', method: 'One airborne reset, then controls-only real-physics Free flight.',
  note: 'Seed 73 crashes after the required ten minutes. Shorter city/coast pilots remain separate. This is qualitative review, not performance acceptance.',
  results,
}, null, 2) + '\n')
console.log(results)
