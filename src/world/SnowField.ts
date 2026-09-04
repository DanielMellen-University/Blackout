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

const FLAKE_COUNT = 3400
/** Half-size of the wrapping volume around the jet, metres. */
const HALF = 110
const SPAN = HALF * 2

/**
 * World-space snow that wraps around the follow point.
 * Updated every rendered frame so flakes do not stutter at high refresh rates.
 */
export class SnowField {
  readonly points: Points
  private readonly pos: Float32Array
  private readonly fall: Float32Array
  private readonly phase: Float32Array
  private readonly mat: PointsMaterial
  private readonly tex: DataTexture
  private clock = 0
  private scattered = false

  constructor() {
    this.pos = new Float32Array(FLAKE_COUNT * 3)
    this.fall = new Float32Array(FLAKE_COUNT)
    this.phase = new Float32Array(FLAKE_COUNT)
    for (let i = 0; i < FLAKE_COUNT; i++) {
      this.fall[i] = 3.8 + Math.random() * 8.4
      this.phase[i] = Math.random() * Math.PI * 2
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.pos, 3))

    this.tex = makeSoftDiscTexture(64)
    this.mat = new PointsMaterial({
      color: 0xeaf3ff,
      map: this.tex,
      size: 0.34,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
      fog: true,
      alphaTest: 0.04,
    })
    this.mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\n\tgl_PointSize = min(gl_PointSize, 15.0);',
      )
    }

    this.points = new Points(geo, this.mat)
    this.points.name = 'SnowField'
    this.points.frustumCulled = false
    this.points.visible = false
  }

  update(dt: number, cx: number, cy: number, cz: number, intensity: number): void {
    const on = intensity > 0.02 && dt > 0
    if (!on) {
      this.mat.opacity = intensity > 0.02 ? this.mat.opacity : 0
      this.points.visible = this.mat.opacity > 0.02
      if (intensity <= 0.02) this.scattered = false
      return
    }

    if (!this.scattered) {
      this.scatter(cx, cy + 10, cz)
      this.scattered = true
    }

    this.clock += dt
    this.points.visible = true
    this.mat.opacity = Math.min(0.9, 0.28 + intensity * 0.62)

    const fallMul = 0.5 + intensity * 1.15
    const wind = 1.8 + intensity * 8.5
    const t = this.clock
    const yCenter = cy + 10

    for (let i = 0; i < FLAKE_COUNT; i++) {
      const ix = i * 3
      const ph = this.phase[i]!
      let x = this.pos[ix]! + Math.sin(t * 0.31 + ph) * wind * dt
      let y = this.pos[ix + 1]! - this.fall[i]! * fallMul * dt
      let z = this.pos[ix + 2]! + Math.cos(t * 0.27 + ph * 1.37) * wind * 0.62 * dt
      this.pos[ix] = wrap(x, cx)
      this.pos[ix + 1] = wrap(y, yCenter)
      this.pos[ix + 2] = wrap(z, cz)
    }
    ;(this.points.geometry.attributes.position as BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.mat.dispose()
    this.tex.dispose()
  }

  private scatter(cx: number, cy: number, cz: number): void {
    for (let i = 0; i < FLAKE_COUNT; i++) {
      this.pos[i * 3] = cx + (Math.random() - 0.5) * SPAN
      this.pos[i * 3 + 1] = cy + (Math.random() - 0.5) * SPAN
      this.pos[i * 3 + 2] = cz + (Math.random() - 0.5) * SPAN
    }
    ;(this.points.geometry.attributes.position as BufferAttribute).needsUpdate = true
  }
}

/** Wrap into [center - HALF, center + HALF). */
export function wrap(value: number, center: number): number {
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
