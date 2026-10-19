import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from 'three'
import { computeSurfaceNormals } from './SurfaceNormals'

export const MAX_DRAPE_VERTICES_PER_FRAME = 1024
const DRAPE_BUDGET_MS = .8
type Surface = { geometry: BufferGeometry; x: number; y: number; z: number;
  revision: number; cursor: number; targetRevision: number; changed: boolean; staged: Float32Array; owners: Float64Array | null; values: Float32Array | null; offsets: Float32Array | null; publish?: () => void }

/** Refit only explicitly marked ground vertices to the same streamed surface
 * used by aircraft contact. Decks/fills remain engineered structures. Work is
 * bounded and published atomically, with no mesh rebuild or material churn. */
export class SurfaceDraper {
  private readonly surfaces: Surface[] = []
  private next = 0
  private readonly height: (x: number, z: number) => number | null
  private readonly revision: () => number
  private readonly heightRevision?: (x: number, z: number) => number
  constructor(height: (x: number, z: number) => number | null, revision: () => number,
    heightRevision?: (x: number, z: number) => number) {
    this.height = height; this.revision = revision; this.heightRevision = heightRevision
  }

  add(geometry: BufferGeometry, x: number, y: number, z: number, publish?: () => void): void {
    const positions = geometry.getAttribute('position')
    if (!(positions instanceof BufferAttribute) || !geometry.getAttribute('groundOffset')) return
    positions.setUsage(DynamicDrawUsage)
    // X/Z never change during a refit. Stage only Y and publish it atomically.
    const staged = new Float32Array(positions.count)
    for (let i = 0; i < positions.count; i++) staged[i] = positions.getY(i)
    const offsets = geometry.getAttribute('groundOffset')
    this.surfaces.push({ geometry, x, y, z, revision: -1, cursor: 0, targetRevision: -1, changed: false,
      staged, owners: this.heightRevision ? new Float64Array(positions.count).fill(-1) : null,
      values: positions.array instanceof Float32Array && !positions.normalized && positions.itemSize === 3 ? positions.array : null,
      publish, offsets: offsets instanceof BufferAttribute && offsets.array instanceof Float32Array && !offsets.normalized && offsets.itemSize === 1 ? offsets.array : null })
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
        const i = surface.cursor++, offset = surface.offsets ? surface.offsets[i]! : offsets.getX(i)
        vertices++
        if (offset >= 0) {
          const x = (surface.values ? surface.values[i * 3]! : positions.getX(i)) + surface.x
          const z = (surface.values ? surface.values[i * 3 + 2]! : positions.getZ(i)) + surface.z
          const owner = this.heightRevision?.(x, z)
          if (owner !== undefined && surface.owners![i] === owner) {
            if (vertices % 32 === 0 && performance.now() >= deadline) break
            continue
          }
          const height = this.height(x, z)
          if (height !== null && Number.isFinite(height)) {
            if (owner !== undefined) surface.owners![i] = owner
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
          if (surface.values) {
            for (let i = 0; i < positions.count; i++) surface.values[i * 3 + 1] = surface.staged[i]!
          } else for (let i = 0; i < positions.count; i++) positions.setY(i, surface.staged[i]!)
          if (surface.publish) surface.publish()
          else {
            positions.needsUpdate = true
            computeSurfaceNormals(surface.geometry); surface.geometry.computeBoundingSphere()
          }
        }
        surface.revision = surface.targetRevision; surface.cursor = 0
        this.next = (this.next + 1) % this.surfaces.length; visited++
      }
      if (performance.now() >= deadline) break
    }
    return probes
  }
}
