// Prescribed contour travel. Keep physics/handling acceptance separate.
const coastFlight = { route: null, elapsed: 0, running: false, mode: 'chase' }
window.__coastal = {
  prepare: route => {
    world.reseed(route.seed); clearRoadTrace(); flying = tracingRiver = weatherTraceDirty = false
    reviewMode = 'coastal-flight'; flightView = true; controls.enabled = false
    coastFlight.route = route; coastFlight.elapsed = 0; coastFlight.running = false
    const p = route.points[0]
    frameWorld({ x: p.x, z: p.z, y: sampleTerrainHeight(p.x, p.z) })
    flightView = true; controls.enabled = false; reviewJet.mesh.visible = true
    window.__coastal.before(0); chase.setMode('chase', reviewJet)
  },
  start: () => { coastFlight.running = true },
  runtime: () => Object.fromEntries(['queueEdgeJoins','publishEdgeJoins','drainBuildQueue'].map(k => [k, String(world.terrain[k])])),
  before: dt => {
    const r = coastFlight.route; if (!r) return
    if (coastFlight.running) coastFlight.elapsed = Math.min(r.seconds, coastFlight.elapsed + dt)
    const distance = coastFlight.elapsed * r.speed, points = r.points
    let lo = 0, hi = points.length - 1
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid].distance <= distance) lo = mid; else hi = mid }
    const a = points[lo], b = points[hi], t = Math.max(0, Math.min(1, (distance - a.distance) / (b.distance - a.distance)))
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t
    const h = Math.max(sampleTerrainHeight(x, z), world.terrain.sampleMeshHeight(x, z) ?? -Infinity)
    reviewJet.reset({ x, y: h + r.clearance, z, yaw: Math.atan2(b.x - a.x, b.z - a.z) }); reviewJet.snapDisplay()
    const mode = Math.floor(coastFlight.elapsed / 30) % 2 ? 'cockpit' : 'chase'
    if (mode !== coastFlight.mode) { coastFlight.mode = mode; chase.setMode(mode, reviewJet) }
    if (coastFlight.elapsed >= r.seconds) coastFlight.running = false
  },
  state: () => ({ seed: world.worldSeed, elapsed: coastFlight.elapsed, running: coastFlight.running,
    distance: coastFlight.elapsed * coastFlight.route.speed, camera: chase.mode, activeCamera: flightView ? chase.mode : 'overview', position: reviewJet.position.toArray(),
    field: coastalField(reviewJet.position.x, reviewJet.position.z), ratio: renderer.getPixelRatio(), stats: world.terrain.streamingStats,
    pendingSeams: world.terrain.seamKeys.size,
    opaqueTiles: [...world.terrain.chunks.values()].filter(c=>c.alpha>.99).length,
    blockedTiles: [...world.terrain.chunks.values()].filter(c=>c.edgePending?.size).length }),
  scan: () => {
    const terrain = world.terrain, focus = reviewJet.position
    const tiles = [...terrain.chunks.values()].filter(c => c.alpha > .99 && c.terrainMesh.visible &&
      Math.hypot(Math.max(c.originX - focus.x, 0, focus.x - c.originX - 420 * c.size),
        Math.max(c.originZ - focus.z, 0, focus.z - c.originZ - 420 * c.size)) < 6500)
    const sample = (tile, edge, t) => {
      const vertical = edge % 2, q = Math.max(0, Math.min(tile.segs, (t - (vertical ? tile.originZ : tile.originX)) * tile.segs / (420 * tile.size)))
      const lo = Math.min(tile.segs - 1, Math.floor(q)), f = q - lo, stride = tile.segs + 1
      const a = edge === 0 ? lo : edge === 1 ? lo * stride + tile.segs : edge === 2 ? tile.segs * stride + lo : lo * stride
      const b = a + (vertical ? stride : 1), n = tile.terrainMesh.geometry.getAttribute('normal'), c = tile.terrainMesh.geometry.getAttribute('color')
      return { h: tile.heights[a] + (tile.heights[b] - tile.heights[a]) * f,
        w: tile.waterLevels[a] + (tile.waterLevels[b] - tile.waterLevels[a]) * f,
        n: [0, 1, 2].map(i => n.getComponent(a, i) + (n.getComponent(b, i) - n.getComponent(a, i)) * f),
        c: [0, 1, 2].map(i => c.getComponent(a, i) + (c.getComponent(b, i) - c.getComponent(a, i)) * f) }
    }
    const coveredBy = (tile, edge, t, y) => {
      const g = tile.terrainMesh.geometry, p = g.getAttribute('position'), ids = g.index.array, core = (tile.segs + 1) ** 2
      const half = 210 * tile.size, vertical = edge % 2, fixed = edge === 0 || edge === 3 ? -half : half
      const along = i => (vertical ? p.getZ(i) + tile.originZ : p.getX(i) + tile.originX) + half
      for (let i = 0; i < ids.length; i += 3) {
        const a = ids[i], b = ids[i + 1], c = ids[i + 2]
        if (Math.min(a, b, c) < core) continue
        if ([a, b, c].some(v => Math.abs((vertical ? p.getX(v) : p.getZ(v)) - fixed) > .001)) continue
        const ax = along(a), ay = p.getY(a), bx = along(b), by = p.getY(b), cx = along(c), cy = p.getY(c)
        const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(det) < 1e-8) continue
        const u = ((by - cy) * (t - cx) + (cx - bx) * (y - cy)) / det
        const v = ((cy - ay) * (t - cx) + (ax - cx) * (y - cy)) / det
        if (Math.min(u, v, 1 - u - v) >= -1e-4) return true
      }
      return false
    }
    const ownerAt = (x,z) => {
      let best = null
      for(const tile of tiles)if(x>=tile.originX&&x<tile.originX+420*tile.size&&z>=tile.originZ&&z<tile.originZ+420*tile.size&&
        (!best||tile.size<best.size||tile.size===best.size&&tile.segs>best.segs))best=tile
      return best
    }
    const cases = []; let shared = 0, maxNormal = 0, maxColor = 0
    for (const a of tiles) for (const b of tiles) {
      if (a.size / a.segs <= b.size / b.segs) continue
      const join = coastalJoin(a, b); if (!join) continue
      const knots = [join.start, join.end], edge = join.edge, opposite = (edge + 2) % 4
      for (const tile of [a, b]) for (let i = 0; i <= tile.segs; i++) {
        const k = (edge % 2 ? tile.originZ : tile.originX) + i * 420 * tile.size / tile.segs
        if (k > join.start && k < join.end) knots.push(k)
      }
      knots.sort((a, b) => a - b)
      for (const t of knots) {
        const qa = (t - (edge % 2 ? a.originZ : a.originX)) * a.segs / (420 * a.size)
        const qb = (t - (edge % 2 ? b.originZ : b.originX)) * b.segs / (420 * b.size)
        if (Math.abs(qa - Math.round(qa)) > 1e-6 || Math.abs(qb - Math.round(qb)) > 1e-6) continue
        const va = sample(a, edge, t), vb = sample(b, opposite, t)
        if (Math.min(va.h, vb.h) > Math.max(va.w, vb.w) + 2) continue
        shared++; maxNormal = Math.max(maxNormal, Math.hypot(...va.n.map((v, i) => v - vb.n[i])))
        maxColor = Math.max(maxColor, ...va.c.map((v, i) => Math.abs(v - vb.c[i])))
      }
      for (let i = 1; i < knots.length; i++) {
        if (knots[i] - knots[i - 1] < 1e-6) continue
        const t = (knots[i] + knots[i - 1]) * .5, va = sample(a, edge, t), vb = sample(b, opposite, t)
        const lo = Math.max(Math.min(va.h, vb.h), va.w + .02, vb.w + .02), hi = Math.max(va.h, vb.h)
        if (Math.min(va.h, vb.h) > Math.max(va.w, vb.w) + 2 || hi - lo < .05) continue
        const x = edge % 2 ? a.originX + (edge === 1 ? 420 * a.size : 0) : t
        const z = edge % 2 ? t : a.originZ + (edge === 2 ? 420 * a.size : 0)
        const dx = edge === 1 ? -.1 : edge === 3 ? .1 : 0, dz = edge === 0 ? .1 : edge === 2 ? -.1 : 0
        if (ownerAt(x + dx, z + dz) !== a || ownerAt(x - dx, z - dz) !== b) continue
        cases.push({ jobs: [[a.originX, a.originZ, a.lod, a.size], [b.originX, b.originZ, b.lod, b.size]],
          keys: [a.key, b.key], fading: [a.fadingOut, b.fadingOut], edge, t, va, vb, x, z, exposed: hi - lo,
          probes: [.1, .5, .9].map(f => { const y = lo + (hi - lo) * f; return { y, covered: coveredBy(a, edge, t, y) || coveredBy(b, opposite, t, y) } }) })
      }
    }
    cases.sort((a, b) => b.exposed - a.exposed)
    const failed = cases.filter(c => c.probes.some(p => !p.covered))
    return { ...window.__coastal.state(), shared, maxNormal, maxColor, count: cases.length, failures: failed.length,
      cases: [...failed.slice(0, 24), ...cases.filter(c => !failed.includes(c)).slice(0, 12)] }
  },
}
