import { readFile, readdir, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
const directory = process.argv[2]
if (!directory) throw new Error('Pass a profile directory')
for (const file of await readdir(directory)) {
  if (!file.endsWith('.cpuprofile.gz')) continue
  const profile = JSON.parse(gunzipSync(await readFile(`${directory}/${file}`)))
  const nodes = new Map(profile.nodes.map(node => [node.id, node]))
  const parents = new Map()
  for (const node of profile.nodes) for (const child of node.children || []) parents.set(child, node.id)
  const self = new Map(), inclusive = new Map()
  const label = node => `${node.callFrame.functionName || '(anonymous)'} (${node.callFrame.url.replace(/^.*\/src\//, 'src/').replace(/\?[^)]*/, '')}:${node.callFrame.lineNumber + 1})`
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i], ms = profile.timeDeltas[i] / 1000
    const key = label(nodes.get(id))
    self.set(key, (self.get(key) || 0) + ms)
    const visited = new Set()
    for (let cursor = id; cursor; cursor = parents.get(cursor)) {
      const name = label(nodes.get(cursor))
      if (!visited.has(name)) { inclusive.set(name, (inclusive.get(name) || 0) + ms); visited.add(name) }
    }
  }
  const rank = entries => [...entries].sort((a, b) => b[1] - a[1]).slice(0, 80)
  await writeFile(`${directory}/${file.replace('.cpuprofile.gz', '-cpu-summary.json')}`,
    JSON.stringify({ durationMs: (profile.endTime - profile.startTime) / 1000, samples: profile.samples.length,
      selfMs: rank(self), inclusiveMs: rank(inclusive) }, null, 2) + '\n')
}
