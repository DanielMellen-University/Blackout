/**
 * Deterministic 2D value noise + FBM for infinite terrain.
 * No external deps; stable across reloads for a given seed.
 */

const SEED = 1337.9182

/** Hash two floats → 0..1 */
export function hash2(x: number, z: number): number {
  let n = Math.sin(x * 127.1 + z * 311.7 + SEED) * 43758.5453123
  n = n - Math.floor(n)
  return n
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Smooth value noise, period ~1 in input space. */
export function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const xf = fade(x - x0)
  const zf = fade(z - z0)

  const n00 = hash2(x0, z0)
  const n10 = hash2(x0 + 1, z0)
  const n01 = hash2(x0, z0 + 1)
  const n11 = hash2(x0 + 1, z0 + 1)

  return lerp(lerp(n00, n10, xf), lerp(n01, n11, xf), zf)
}

/** Fractal Brownian motion, output roughly 0..1. */
export function fbm(
  x: number,
  z: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return norm > 0 ? sum / norm : 0
}

/** Ridged multifractal for mountain spines (0..1). */
export function ridged(x: number, z: number, octaves = 4): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, z * freq) * 2 - 1)
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    freq *= 2.1
  }
  return norm > 0 ? sum / norm : 0
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
