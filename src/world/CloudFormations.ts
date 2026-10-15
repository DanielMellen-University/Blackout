export type CloudLayer = 'cumulus' | 'stratus' | 'cirrus'
export interface CloudPuff {
  x: number; y: number; z: number
  sx: number; sy: number; sz: number
  rotationY: number
}

export const CLOUD_CELL_SIZE = 8000
export const CLOUD_PUFFS_PER_FORMATION = { cumulus: 16, stratus: 18, cirrus: 8 } as const
const UNASSIGNED = 0x7fffffff

/** Cell identity, not pool slot or visitation order, determines appearance. */
export function cloudCellRandom(seed: number, x: number, z: number, salt: number): number {
  let n = Math.imul(Math.round(seed * 1000000), 1274126177) ^
    Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 0x9e3779b9)
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d)
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

export function cloudCellLayer(seed: number, x: number, z: number): CloudLayer {
  const roll = cloudCellRandom(seed, x, z, 1)
  return roll < 20 / 46 ? 'cumulus' : roll < 36 / 46 ? 'stratus' : 'cirrus'
}

/** Fill existing objects once when a cell enters the bounded pool. Cumulus has
 * a broad lower crown, rising irregular towers and a separate upper crown that
 * can spread into an anvil. Stratus is a connected, uneven sheet; cirrus wisps
 * are offset, broken and narrow. No temporary RNG stream or meshes. */
export function shapeCloudFormation(puffs: readonly CloudPuff[], layer: CloudLayer,
  seed: number, cx: number, cz: number): void {
  const size = .65 + cloudCellRandom(seed, cx, cz, 7) * 1.1
  const angle = cloudCellRandom(seed, cx, cz, 11) * Math.PI * 2
  const cos = Math.cos(angle), sin = Math.sin(angle)
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i]!, t = i / Math.max(1, puffs.length - 1)
    const a = cloudCellRandom(seed, cx, cz, 31 + i * 5)
    const b = cloudCellRandom(seed, cx, cz, 32 + i * 5)
    const c = cloudCellRandom(seed, cx, cz, 33 + i * 5)
    let along: number, across: number
    if (layer === 'cumulus') {
      const crown = t < .32
      const radial = crown ? 350 : 150 + (1 - t) * 100
      const phase = i * 2.399963 + a
      along = Math.cos(phase) * radial * (.4 + a * .6)
      across = Math.sin(phase) * radial * (.4 + b * .6)
      p.sx = (crown ? 320 + a * 180 : 280 + a * 180) * size
      p.sy = (crown ? 320 + b * 140 : 430 + b * 250) * size
      p.sz = p.sx * (.85 + c * .3)
      // Overlap a continuous irregular tower instead of three horizontal
      // tiers. Convection spreads the upper puffs into an anvil at rendering.
      p.y = p.sy + (crown ? b * 50 : (t - .32) / .68 * 1000 + (c - .5) * 180) * size
    } else if (layer === 'stratus') {
      const row = i % 3
      along = (Math.floor(i / 3) / Math.max(1, Math.ceil(puffs.length / 3) - 1) - .5) * 3600
      across = (row - 1) * 650 + (a - .5) * 180
      p.sx = (650 + a * 220) * size
      p.sy = (180 + b * 140) * size
      p.sz = (580 + c * 170) * size
      p.y = p.sy + (b - .5) * 140 * size
    } else {
      along = (t - .5) * 3300
      across = Math.sin(t * 4 + a) * 280 + (b - .5) * 200
      p.sx = (450 + a * 250) * size
      p.sy = (40 + b * 35) * size
      p.sz = (90 + c * 60) * size
      p.y = (b - .5) * 100 * size
    }
    p.x = (along * cos - across * sin) * size
    p.z = (along * sin + across * cos) * size
    p.rotationY = -angle
  }
}

/** Fixed 46-slot field. At most 81 cells are considered at 5 Hz; retain slots
 * whose identities remain selected. A renderer retires old identities before
 * adopting targetX/Z, so selection never teleports a visible formation. */
export class CloudCells {
  readonly layers: readonly CloudLayer[]
  readonly cellX: Int32Array
  readonly cellZ: Int32Array
  readonly targetX: Int32Array
  readonly targetZ: Int32Array
  private readonly candidateX = new Int32Array(81)
  private readonly candidateZ = new Int32Array(81)
  private readonly candidateDistance = new Float64Array(81)
  private readonly candidateLayer = new Uint8Array(81)
  private readonly selected = new Uint8Array(81)
  private readonly retained: Uint8Array

  constructor(layers: readonly CloudLayer[]) {
    if (layers.length > 46) throw new Error('Cloud formation capacity exceeded')
    this.layers = layers
    this.cellX = new Int32Array(layers.length).fill(UNASSIGNED)
    this.cellZ = new Int32Array(layers.length).fill(UNASSIGNED)
    this.targetX = new Int32Array(layers.length).fill(UNASSIGNED)
    this.targetZ = new Int32Array(layers.length).fill(UNASSIGNED)
    this.retained = new Uint8Array(layers.length)
  }

  reset(): void { this.cellX.fill(UNASSIGNED); this.cellZ.fill(UNASSIGNED) }
  unassigned(slot: number): boolean { return this.cellX[slot] === UNASSIGNED }
  hasTarget(slot: number): boolean { return this.targetX[slot] !== UNASSIGNED }
  moving(slot: number): boolean {
    return this.cellX[slot] !== this.targetX[slot] || this.cellZ[slot] !== this.targetZ[slot]
  }
  adopt(slot: number): void {
    this.cellX[slot] = this.targetX[slot]!
    this.cellZ[slot] = this.targetZ[slot]!
  }

  select(seed: number, x: number, z: number, time: number): void {
    const wx = x - time * 12, wz = z - time * 3
    const cx = Math.floor(wx / CLOUD_CELL_SIZE), cz = Math.floor(wz / CLOUD_CELL_SIZE)
    this.selected.fill(0); this.retained.fill(0)
    let count = 0
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const px = cx + dx, pz = cz + dz
      const fx = (px + .5) * CLOUD_CELL_SIZE - wx, fz = (pz + .5) * CLOUD_CELL_SIZE - wz
      this.candidateX[count] = px; this.candidateZ[count] = pz
      this.candidateDistance[count] = fx * fx + fz * fz
      const layer = cloudCellLayer(seed, px, pz)
      this.candidateLayer[count++] = layer === 'cumulus' ? 0 : layer === 'stratus' ? 1 : 2
    }
    for (let family = 0; family < 3; family++) {
      const layer: CloudLayer = family === 0 ? 'cumulus' : family === 1 ? 'stratus' : 'cirrus'
      let capacity = 0
      for (const candidate of this.layers) if (candidate === layer) capacity++
      for (let n = 0; n < capacity; n++) {
        let nearest = -1, distance = Infinity
        for (let j = 0; j < count; j++) if (!this.selected[j] && this.candidateLayer[j] === family &&
          this.candidateDistance[j]! < distance) {
          nearest = j; distance = this.candidateDistance[j]!
        }
        if (nearest >= 0) this.selected[nearest] = 1
      }
    }
    // Match existing identities first, independently of nearest-cell rank.
    for (let i = 0; i < this.layers.length; i++) {
      for (let j = 0; j < count; j++) if (this.selected[j] === 1 &&
        this.cellX[i] === this.candidateX[j] && this.cellZ[i] === this.candidateZ[j]) {
        this.targetX[i] = this.cellX[i]!; this.targetZ[i] = this.cellZ[i]!
        this.retained[i] = 1; this.selected[j] = 2; break
      }
    }
    for (let i = 0; i < this.layers.length; i++) {
      if (this.retained[i]) continue
      const family = this.layers[i] === 'cumulus' ? 0 : this.layers[i] === 'stratus' ? 1 : 2
      let nearest = -1, distance = Infinity
      for (let j = 0; j < count; j++) if (this.selected[j] === 1 && this.candidateLayer[j] === family &&
        this.candidateDistance[j]! < distance) { nearest = j; distance = this.candidateDistance[j]! }
      if (nearest >= 0) {
        this.targetX[i] = this.candidateX[nearest]!; this.targetZ[i] = this.candidateZ[nearest]!
        this.selected[nearest] = 2
      } else {
        // Very rare family-poor windows retain a distant, faded identity.
        this.targetX[i] = this.cellX[i]!; this.targetZ[i] = this.cellZ[i]!
      }
    }
  }
}
