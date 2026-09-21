import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three'

export const MAX_GHOST_SAMPLES = 720
export const GHOST_SAMPLE_INTERVAL = 0.1
export const GHOST_STORAGE_PREFIX = 'blackout.ghost.'

interface GhostStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface StoredGhost {
  version: 1
  score: number
  samples: number[]
}

/**
 * Lightweight best-run ghost path. One fixed line and marker are shared by
 * retries; flight recording stays in bounded typed arrays and storage writes
 * happen only when a run sets a new score.
 */
export class GhostReplay {
  readonly root = new Group()

  private readonly storage: GhostStorage | null
  private readonly lineGeometry = new BufferGeometry()
  private readonly lineMaterial = new LineBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.2,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  private readonly markerGeometry = new SphereGeometry(1.4, 8, 6)
  private readonly markerMaterial = new MeshBasicMaterial({
    color: 0xa5f3fc,
    transparent: true,
    opacity: 0.48,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  private readonly line: Line
  private readonly marker: Mesh
  private readonly linePositions = new Float32Array(MAX_GHOST_SAMPLES * 3)
  private readonly recordPositions = new Float32Array(MAX_GHOST_SAMPLES * 3)
  private readonly recordTimes = new Float32Array(MAX_GHOST_SAMPLES)
  private readonly ghostPositions = new Float32Array(MAX_GHOST_SAMPLES * 3)
  private readonly ghostTimes = new Float32Array(MAX_GHOST_SAMPLES)
  private lineAttribute: BufferAttribute
  private recordCount = 0
  private ghostCount = 0
  private nextRecordTime = 0
  private ghostCursor = 0
  private currentKey = ''
  private showRequested = false
  private disposed = false

  constructor(scene: Scene | Group, storage: GhostStorage | null = null) {
    this.storage = storage
    this.lineAttribute = new BufferAttribute(this.linePositions, 3)
    this.lineGeometry.setAttribute('position', this.lineAttribute)
    this.lineGeometry.setDrawRange(0, 0)
    this.line = new Line(this.lineGeometry, this.lineMaterial)
    this.line.frustumCulled = false
    this.line.name = 'BestRunGhostPath'
    this.marker = new Mesh(this.markerGeometry, this.markerMaterial)
    this.marker.name = 'BestRunGhostMarker'
    this.marker.visible = false
    this.marker.frustumCulled = false
    this.root.name = 'GhostReplay'
    this.root.visible = false
    this.root.add(this.line, this.marker)
    scene.add(this.root)
  }

  /** Load a bounded best path for the current repeatable course. */
  reset(courseKey: string): void {
    if (this.disposed) return
    this.recordCount = 0
    this.ghostCount = 0
    this.nextRecordTime = 0
    this.ghostCursor = 0
    this.currentKey = typeof courseKey === 'string' && courseKey.startsWith('seed:')
      ? courseKey
      : ''
    this.marker.visible = false
    this.lineGeometry.setDrawRange(0, 0)
    this.root.visible = false
    if (!this.currentKey || !this.storage) return

    let raw: string | null = null
    try {
      raw = this.storage.getItem(storageKey(this.currentKey))
    } catch {
      return
    }
    const parsed = parseStoredGhost(raw)
    if (!parsed) return
    this.ghostCount = Math.floor(parsed.samples.length / 4)
    for (let i = 0; i < this.ghostCount; i += 1) {
      const source = i * 4
      this.ghostTimes[i] = parsed.samples[source]!
      this.ghostPositions[i * 3] = parsed.samples[source + 1]!
      this.ghostPositions[i * 3 + 1] = parsed.samples[source + 2]!
      this.ghostPositions[i * 3 + 2] = parsed.samples[source + 3]!
      this.linePositions[i * 3] = this.ghostPositions[i * 3]!
      this.linePositions[i * 3 + 1] = this.ghostPositions[i * 3 + 1]!
      this.linePositions[i * 3 + 2] = this.ghostPositions[i * 3 + 2]!
    }
    this.lineAttribute.needsUpdate = true
    this.lineGeometry.setDrawRange(0, this.ghostCount)
  }

  /** Record at most one sample per bounded interval during an active sortie. */
  record(time: number, position: Vector3): void {
    if (this.disposed || !this.currentKey || this.recordCount >= MAX_GHOST_SAMPLES) return
    if (!Number.isFinite(time) || time <= 0 || !finiteVector(position)) return
    const previousTime = this.recordCount > 0 ? this.recordTimes[this.recordCount - 1]! : -Infinity
    if (time < previousTime || time < this.nextRecordTime) return
    const index = this.recordCount
    this.recordTimes[index] = time
    this.recordPositions[index * 3] = position.x
    this.recordPositions[index * 3 + 1] = position.y
    this.recordPositions[index * 3 + 2] = position.z
    this.recordCount += 1
    this.nextRecordTime = time + GHOST_SAMPLE_INTERVAL
  }

  /** Persist only a new best score, keeping local storage bounded. */
  commitIfBest(isNewBest: boolean, score: number): boolean {
    if (this.disposed || !isNewBest || !this.currentKey || !this.storage || this.recordCount < 2) return false
    const samples: number[] = []
    for (let i = 0; i < this.recordCount; i += 1) {
      samples.push(
        round(this.recordTimes[i]!, 100),
        round(this.recordPositions[i * 3]!, 10),
        round(this.recordPositions[i * 3 + 1]!, 10),
        round(this.recordPositions[i * 3 + 2]!, 10),
      )
    }
    const payload: StoredGhost = {
      version: 1,
      score: Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0,
      samples,
    }
    try {
      this.storage.setItem(storageKey(this.currentKey), JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }

  /** Toggle presentation without mutating the recorded path. */
  setVisible(visible: boolean): void {
    if (this.disposed) return
    this.showRequested = visible
    this.root.visible = visible && this.ghostCount >= 2
  }

  /** Move the marker along the loaded best path using the current run clock. */
  update(time: number, externalView: boolean): void {
    if (this.disposed) return
    const visible = this.showRequested && externalView && this.ghostCount >= 2
    this.root.visible = visible
    if (!visible || !Number.isFinite(time)) {
      this.marker.visible = false
      return
    }
    const safeTime = Math.max(0, time)
    if (safeTime < this.ghostTimes[this.ghostCursor]!) this.ghostCursor = 0
    while (this.ghostCursor + 1 < this.ghostCount && this.ghostTimes[this.ghostCursor + 1]! <= safeTime) {
      this.ghostCursor += 1
    }
    if (this.ghostCursor >= this.ghostCount - 1) {
      this.marker.visible = false
      return
    }
    const a = this.ghostCursor
    const b = a + 1
    const span = this.ghostTimes[b]! - this.ghostTimes[a]!
    const t = span > 1e-6 ? Math.max(0, Math.min(1, (safeTime - this.ghostTimes[a]!) / span)) : 0
    this.marker.position.set(
      this.ghostPositions[a * 3]! + (this.ghostPositions[b * 3]! - this.ghostPositions[a * 3]!) * t,
      this.ghostPositions[a * 3 + 1]! + (this.ghostPositions[b * 3 + 1]! - this.ghostPositions[a * 3 + 1]!) * t,
      this.ghostPositions[a * 3 + 2]! + (this.ghostPositions[b * 3 + 2]! - this.ghostPositions[a * 3 + 2]!) * t,
    )
    this.marker.visible = true
  }

  get recordedSampleCount(): number {
    return this.recordCount
  }

  get ghostSampleCount(): number {
    return this.ghostCount
  }

  /** Signed live-run delta against the stored best trace duration. */
  paceDelta(time: number): number | null {
    if (this.disposed || this.ghostCount < 2 || !Number.isFinite(time)) return null
    const duration = this.ghostTimes[this.ghostCount - 1]!
    return Math.max(-9_999, Math.min(9_999, time - duration))
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeFromParent()
    this.lineGeometry.dispose()
    this.lineMaterial.dispose()
    this.markerGeometry.dispose()
    this.markerMaterial.dispose()
  }
}

function storageKey(courseKey: string): string {
  return `${GHOST_STORAGE_PREFIX}${courseKey}`
}

function parseStoredGhost(raw: string | null): StoredGhost | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const candidate = value as Partial<StoredGhost>
    if (candidate.version !== 1 || !Array.isArray(candidate.samples)) return null
    if (candidate.samples.length < 8 || candidate.samples.length > MAX_GHOST_SAMPLES * 4 || candidate.samples.length % 4 !== 0) return null
    const samples = candidate.samples.map(Number)
    if (samples.some(value => !Number.isFinite(value))) return null
    for (let i = 4; i < samples.length; i += 4) {
      if (samples[i]! < samples[i - 4]!) return null
    }
    return {
      version: 1,
      score: Number.isFinite(candidate.score) ? Math.max(0, Math.floor(candidate.score!)) : 0,
      samples,
    }
  } catch {
    return null
  }
}

function finiteVector(value: Vector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function round(value: number, scale: number): number {
  return Math.round(value * scale) / scale
}
