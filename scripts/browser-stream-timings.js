const timings = window.__streamTimings = {};
const wrap = (prototype, method, label) => {
  const original = prototype[method];
  if (typeof original !== 'function') throw new Error('Missing diagnostic method: '+label);
  const record = timings[label] ??= { calls: 0, totalMs: 0, maxMs: 0, over2: 0, over8: 0, over16: 0, slowest: [] };
  prototype[method] = function(...args) {
    const start = performance.now();
    try { return original.apply(this, args); }
    finally {
      const ms = performance.now()-start;
      record.calls++; record.totalMs+=ms; record.maxMs=Math.max(record.maxMs,ms);
      if(ms>2)record.over2++; if(ms>8)record.over8++; if(ms>16)record.over16++;
      if(ms>2){record.slowest.push({atMs:start,ms});record.slowest.sort((a,b)=>b.ms-a.ms);record.slowest.length=Math.min(20,record.slowest.length)}
    }
  };
};
window.__installStreamTimings = (kind, prototype) => {
  const methods = {
    TerrainSystem: ['buildChunk','install','scheduleAround','updateFades','drainBuildQueue'],
    SettlementSystem: ['build','buildRegionalRoad','update','dispatchNearbyJob'],
    SurfaceDraper: ['update'],
  };
  const prefix = { TerrainSystem: 'terrain', SettlementSystem: 'settlement', SurfaceDraper: 'drape' }[kind];
  for (const method of methods[kind]) wrap(prototype, method, prefix+'.'+method);
  if (kind !== 'SurfaceDraper') return;
// Diagnostic-only publication audit. Copies live behind the geometry's weak
// lifetime and are excluded from the uninstrumented acceptance runs.
const publications = timings.drapePublications ??= { total: 0, unchanged: 0, positionBytes: 0 };
const addSurface = prototype.add;
prototype.add = function(geometry, ...args) {
  if (geometry.getAttribute('groundOffset')) {
    const positions = geometry.getAttribute('position');
    const previous = positions.array.slice();
    const normals = geometry.computeVertexNormals;
    geometry.computeVertexNormals = function() {
      publications.total++; publications.positionBytes += positions.array.byteLength;
      if (positions.array.every((value, i) => value === previous[i])) publications.unchanged++;
      previous.set(positions.array);
      return normals.call(this);
    };
    wrap(geometry, 'computeVertexNormals', 'drape.normals');
    wrap(geometry, 'computeBoundingSphere', 'drape.bounds');
  }
  return addSurface.call(this, geometry, ...args);
};

};
