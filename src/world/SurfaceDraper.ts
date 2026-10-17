import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from 'three'

export const MAX_DRAPE_VERTICES_PER_FRAME = 1024
const DRAPE_BUDGET_MS = .8
type Surface = { geometry: BufferGeometry; x: number; y: number; z: number;
  revision: number; cursor: number; targetRevision: number; changed: boolean; staged: Float32Array }

/** Refit only explicitly marked ground vertices to the same streamed surface
 * used by aircraft contact. Decks/fills remain engineered structures. Work is
 * bounded and published atomically, with no mesh rebuild or material churn. */
export class SurfaceDraper {
  private readonly surfaces: Surface[] = []
  private next = 0
  private readonly height: (x: number, z: number) => number | null
  private readonly revision: () => number
  constructor(height: (x: number, z: number) => number | null, revision: () => number) {
    this.height = height; this.revision = revision
  }

  add(geometry: BufferGeometry, x: number, y: number, z: number): void {
    const positions = geometry.getAttribute('position')
    if (!(positions instanceof BufferAttribute) || !geometry.getAttribute('groundOffset')) return
    positions.setUsage(DynamicDrawUsage)
    // X/Z never change during a refit. Stage only Y and publish it atomically.
    const staged = new Float32Array(positions.count)
    for (let i = 0; i < positions.count; i++) staged[i] = positions.getY(i)
    this.surfaces.push({ geometry, x, y, z, revision: -1, cursor: 0, targetRevision: -1, changed: false,
      staged })
  }

  remove(geometry: BufferGeometry): void {
    const index = this.surfaces.findIndex(surface => surface.geometry === geometry)
    if (index < 0) return
    this.surfaces.splice(index, 1)
    if (this.next >= this.surfaces.length) this.next = 0
  }

  clear(): void { this.surfaces.length = 0; this.next = 0 }

  update(): number {
    const revision = this.revision(), deadline = performance.now() + DRAPE_BUDGET_MS
    let probes = 0, vertices = 0, visited = 0
    while (this.surfaces.length && vertices < MAX_DRAPE_VERTICES_PER_FRAME && visited < this.surfaces.length) {
      const surface = this.surfaces[this.next]!
      if (surface.revision === revision && !surface.cursor) {
        this.next = (this.next + 1) % this.surfaces.length; visited++; continue
      }
      const positions = surface.geometry.getAttribute('position') as BufferAttribute
      const offsets = surface.geometry.getAttribute('groundOffset') as BufferAttribute
      if (!surface.cursor) { surface.targetRevision = revision; surface.changed = false }
      while (surface.cursor < positions.count && vertices < MAX_DRAPE_VERTICES_PER_FRAME) {
        const i = surface.cursor++, offset = offsets.getX(i)
        vertices++
        if (offset >= 0) {
          const height = this.height(positions.getX(i) + surface.x, positions.getZ(i) + surface.z)
          if (height !== null && Number.isFinite(height)) {
            // Compare in the attribute's actual precision. Distant tile changes
            // must not republish identical roads and rebuild all their normals.
            const y = Math.fround(height + offset - surface.y)
            if (surface.staged[i] !== y) {
              surface.staged[i] = y; surface.changed = true
            }
          }
          probes++
        }
        if (vertices % 32 === 0 && performance.now() >= deadline) break
      }
      if (surface.cursor === positions.count) {
        if (surface.changed) {
          for (let i = 0; i < positions.count; i++) positions.setY(i, surface.staged[i]!)
          positions.needsUpdate = true
          surface.geometry.computeVertexNormals(); surface.geometry.computeBoundingSphere()
        }
        surface.revision = surface.targetRevision; surface.cursor = 0
        this.next = (this.next + 1) % this.surfaces.length; visited++
      }
      if (performance.now() >= deadline) break
    }
    return probes
  }
}
