window.__shore = {
  place: p => {
    clearRoadTrace(); flying = false; tracingRiver = false; weatherTraceDirty = false
    reviewMode = 'shore-review'; frameWorld({ x: p.x, z: p.z, y: sampleTerrainHeight(p.x, p.z) })
  },
  pose: (p, mode) => {
    flightView = true; controls.enabled = false
    const h = world.terrain.sampleMeshHeight(p.x, p.z) ?? sampleTerrainHeight(p.x, p.z)
    reviewJet.reset({ x: p.x, y: Math.max(h, sampleGroundHeight(p.x, p.z)) + 90, z: p.z, yaw: p.yaw })
    reviewJet.snapDisplay(); chase.setMode(mode, reviewJet)
  },
  scan: () => {
    const tiles = [...world.terrain.chunks.values()].filter(c => !c.fadingOut && c.alpha > .99)
    const cases = []
    const sample = (tile, edge, t) => {
      const vertical = edge % 2 === 1, q = (t - (vertical ? tile.originZ : tile.originX)) * tile.segs / (420 * tile.size)
      const lo = Math.max(0, Math.min(tile.segs - 1, Math.floor(q))), f = q - lo, stride = tile.segs + 1
      const a = edge === 0 ? lo : edge === 1 ? lo * stride + tile.segs : edge === 2 ? tile.segs * stride + lo : lo * stride
      const b = a + (vertical ? stride : 1)
      return { h: tile.heights[a] + (tile.heights[b] - tile.heights[a]) * f,
        w: tile.waterLevels[a] + (tile.waterLevels[b] - tile.waterLevels[a]) * f }
    }
    for (const a of tiles) for (const b of tiles) {
      if (a.size / a.segs <= b.size / b.segs) continue
      const join = shoreJoin(a, b); if (!join) continue
      const knots = [join.start, join.end]
      for (const tile of [a, b]) for (let i = 0; i <= tile.segs; i++) {
        const k = (join.edge % 2 ? tile.originZ : tile.originX) + i * 420 * tile.size / tile.segs
        if (k > join.start && k < join.end) knots.push(k)
      }
      knots.sort((a, b) => a - b)
      for (let i = 1; i < knots.length; i++) {
        const t = (knots[i - 1] + knots[i]) / 2, va = sample(a, join.edge, t), vb = sample(b, (join.edge + 2) % 4, t)
        const level = Math.max(va.w, vb.w), low = Math.min(va.h, vb.h), high = Math.max(va.h, vb.h)
        const exposed = high - Math.max(low, level + .02)
        if (low > level + 2 || exposed < .05) continue
        cases.push({ jobs: [[a.originX, a.originZ, a.lod, a.size], [b.originX, b.originZ, b.lod, b.size]],
          edge: join.edge, t, va, vb, exposed, x: join.edge % 2 ? a.originX + (join.edge === 1 ? 420 * a.size : 0) : t,
          z: join.edge % 2 ? t : a.originZ + (join.edge === 2 ? 420 * a.size : 0) })
      }
    }
    cases.sort((a, b) => b.exposed - a.exposed)
    return { cases: cases.slice(0, 12), count: cases.length, pending: world.terrain.seamKeys.size,
      stats: world.terrain.streamingStats, position: reviewJet.position.toArray(), camera: chase.mode }
  },
}
