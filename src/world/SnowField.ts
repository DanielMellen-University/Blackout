import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  Points,
  PointsMaterial,
  RGBAFormat,
  UnsignedByteType,
} from 'three'

const FLAKE_COUNT = 4200
/** Half-size of the wrapping volume around the jet, metres. */
const HALF = 110
const SPAN = HALF * 2
/** Leave a clear band over the ground so close flakes cannot veil terrain. */
const GROUND_CLEARANCE = 18
const SNOW_WAVE_SIZE = 256
const SNOW_WAVE_MASK = SNOW_WAVE_SIZE - 1
const SNOW_WAVE_SCALE = SNOW_WAVE_SIZE / (Math.PI * 2)
const SNOW_WAVE = Float32Array.from(
  { length: SNOW_WAVE_SIZE },
  (_, i) => Math.sin((i / SNOW_WAVE_SIZE) * Math.PI * 2),
)

/** Stable integer mixer for seeded precipitation without a shared RNG stream. */
function snowHash(seed: number, index: number, salt: number): number {
  let value = (Math.trunc(seed) | 0) ^ Math.imul(index + 1, 0x9e3779b9) ^ Math.imul(Math.trunc(salt) | 0, 0x85ebca6b)
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

function snowRandom(seed: number, index: number, salt: number): number {
  return snowHash(seed, index, salt) / 0x1_0000_0000
}

/** Clamp a pooled particle budget without allowing an accidental zero draw. */
export function precipitationParticleCount(total: number, scale: number): number {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0))
  if (safeTotal === 0) return 0
  const safeScale = Number.isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 1
  return Math.max(1, Math.min(safeTotal, Math.floor(safeTotal * safeScale)))
}

/** Quantized periodic sway shared by every snow flake. */
export function snowWave(phase: number): number {
  if (!Number.isFinite(phase)) return 0
  const index = Math.floor(phase * SNOW_WAVE_SCALE) & SNOW_WAVE_MASK
  return SNOW_WAVE[index]!
}

/**
 * World-space snow that wraps around the follow point.
 * Updated every rendered frame so flakes do not stutter at high refresh rates.
 */
export class SnowField {
  readonly points: Points
  private readonly pos: Float32Array
  private readonly fall: Float32Array
  private readonly phase: Float32Array
  private readonly size: Float32Array
  private readonly mat: PointsMaterial
  private readonly tex: DataTexture
  private clock = 0
  private scattered = false
  private activeCountValue = FLAKE_COUNT
  private seedValue = 0
  private disposed = false

  constructor() {
    this.pos = new Float32Array(FLAKE_COUNT * 3)
    this.fall = new Float32Array(FLAKE_COUNT)
    this.phase = new Float32Array(FLAKE_COUNT)
    this.size = new Float32Array(FLAKE_COUNT)
    this.setSeed(0)

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.pos, 3))
    geo.setAttribute('snowSize', new BufferAttribute(this.size, 1))

    this.tex = makeSoftDiscTexture(64)
    this.mat = new PointsMaterial({
      color: 0xd9e8f4,
      map: this.tex,
      size: 0.36,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
      fog: true,
      alphaTest: 0.08,
    })
    this.mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\n\tattribute float snowSize;',
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\n\tgl_PointSize = min(gl_PointSize * snowSize, 15.0);',
      )
    }

    this.points = new Points(geo, this.mat)
    this.points.name = 'SnowField'
    this.points.frustumCulled = false
    this.points.visible = false
  }

  get activeCount(): number {
    return this.activeCountValue
  }

  /** Re-key the pooled field when a new deterministic world is committed. */
  setSeed(seed: number): void {
    if (this.disposed) return
    this.seedValue = Number.isFinite(seed) ? Math.trunc(seed) : 0
    for (let i = 0; i < FLAKE_COUNT; i++) {
      this.fall[i] = 3.8 + snowRandom(this.seedValue, i, 11) * 8.4
      this.phase[i] = snowRandom(this.seedValue, i, 23) * Math.PI * 2
      this.size[i] = .46 + snowRandom(this.seedValue, i, 37) * .42
    }
    this.clock = 0
    this.scattered = false
  }

  /** Apply the selected graphics preset to the pooled snow budget. */
  setDensityScale(scale: number): void {
    if (this.disposed) return
    const next = precipitationParticleCount(FLAKE_COUNT, scale)
    if (next === this.activeCountValue) return
    this.activeCountValue = next
    this.points.geometry.setDrawRange(0, next)
    // Newly enabled flakes need a fresh world-space distribution instead of
    // appearing at the origin when a preset is raised during a storm.
    this.scattered = false
  }

  update(
    dt: number,
    cx: number,
    cy: number,
    cz: number,
    intensity: number,
    windX = 0,
    windZ = 0,
  ): void {
    if (this.disposed) return
    const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0
    const safeCx = Number.isFinite(cx) ? cx : 0
    const safeCy = Number.isFinite(cy) ? cy : 0
    const safeCz = Number.isFinite(cz) ? cz : 0
    const safeIntensity = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0
    const safeWindX = Number.isFinite(windX) ? windX : 0
    const safeWindZ = Number.isFinite(windZ) ? windZ : 0
    const on = safeIntensity > 0.02 && safeDt > 0
    if (!on) {
      this.mat.opacity = safeIntensity > 0.02 ? this.mat.opacity : 0
      this.points.visible = this.mat.opacity > 0.02
      if (safeIntensity <= 0.02) this.scattered = false
      return
    }

    if (!this.scattered) {
      // Keep the pooled volume above the aircraft anchor. At runway height,
      // flakes below y=0 render through transparent terrain and read as static.
      this.scatter(safeCx, safeCy + HALF + GROUND_CLEARANCE, safeCz)
      this.scattered = true
    }

    this.clock += safeDt
    this.points.visible = true
    this.mat.opacity = Math.min(0.36, 0.12 + safeIntensity * 0.24)

    const fallMul = 0.5 + safeIntensity * 1.15
    const wind = 1.8 + safeIntensity * 8.5
    // Match the weather front's actual wind direction instead of making snow
    // drift in an unrelated local orbit. The sway remains as a small natural
    // wobble, while the low multiplier keeps flakes inside the pooled field.
    const driftX = safeWindX * (.22 + safeIntensity * .16)
    const driftZ = safeWindZ * (.22 + safeIntensity * .16)
    const t = this.clock
    const yCenter = safeCy + HALF + GROUND_CLEARANCE

    for (let i = 0; i < this.activeCountValue; i++) {
      const ix = i * 3
      const ph = this.phase[i]!
      let x = this.pos[ix]! + (driftX + snowWave(t * 0.31 + ph) * wind) * safeDt
      let y = this.pos[ix + 1]! - this.fall[i]! * fallMul * safeDt
      let z = this.pos[ix + 2]! +
        (driftZ + snowWave(t * 0.27 + ph * 1.37 + Math.PI / 2) * wind * 0.62) * safeDt
      this.pos[ix] = wrap(x, safeCx)
      this.pos[ix + 1] = wrap(y, yCenter)
      this.pos[ix + 2] = wrap(z, safeCz)
    }
    ;(this.points.geometry.attributes.position as BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.points.removeFromParent()
    this.points.geometry.dispose()
    this.mat.dispose()
    this.tex.dispose()
  }

  private scatter(cx: number, cy: number, cz: number): void {
    // Quantized anchor salts keep a retried seed visually identical while the
    // wrapping volume still gets a fresh deterministic pattern after travel.
    const cellX = Math.floor(cx / SPAN)
    const cellZ = Math.floor(cz / SPAN)
    const anchorSalt = Math.imul(cellX, 374761393) ^ Math.imul(cellZ, 668265263)
    for (let i = 0; i < FLAKE_COUNT; i++) {
      this.pos[i * 3] = cx + (snowRandom(this.seedValue, i, anchorSalt + 41) - 0.5) * SPAN
      this.pos[i * 3 + 1] = cy + (snowRandom(this.seedValue, i, anchorSalt + 53) - 0.5) * SPAN
      this.pos[i * 3 + 2] = cz + (snowRandom(this.seedValue, i, anchorSalt + 67) - 0.5) * SPAN
    }
    ;(this.points.geometry.attributes.position as BufferAttribute).needsUpdate = true
  }
}

/** Wrap into [center - HALF, center + HALF). */
export function wrap(value: number, center: number): number {
  if (!Number.isFinite(center)) return 0
  if (!Number.isFinite(value)) return center
  let d = value - center + HALF
  d -= Math.floor(d / SPAN) * SPAN
  return center + d - HALF
}

function makeSoftDiscTexture(size: number): DataTexture {
  const data = new Uint8Array(size * size * 4)
  const mid = (size - 1) * 0.5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x - mid) / mid
      const v = (y - mid) / mid
      const r = Math.hypot(u, v)
      const a = r >= 1 ? 0 : Math.pow(1 - r, 1.55)
      const i = (y * size + x) * 4
      data[i] = 255
      data[i + 1] = 252
      data[i + 2] = 255
      data[i + 3] = Math.round(a * 255)
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}
