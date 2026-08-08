/**
 * Fast deterministic 2D value noise + FBM for infinite terrain.
 * Seed is mutable so each spawn can roll a new world.
 */

let worldSeed = 1337.9182
/** Integer mix of seed for bit hashing. */
let seedI = 1337 | 0

/** Current world seed (for debug / HUD later). */
export function getWorldSeed(): number {
  return worldSeed
}

/** Set an explicit seed and invalidate any cached noise assumptions. */
export function setWorldSeed(seed: number): void {
  worldSeed = seed === 0 ? 0.001 : seed
  seedI = (worldSeed * 1e6) | 0
}

/** Fresh random seed for a new world (call before rebuilding chunks). */
export function randomizeWorldSeed(): number {
  worldSeed = Math.random() * 1_000_000 + Math.random() * 999.731
  seedI = (worldSeed * 1e6) | 0
  return worldSeed
}

/**
 * Hash two numbers → 0..1. Integer bit-mix (no Math.sin) — much faster
 * under heavy fbm sampling.
 */
export function hash2(x: number, z: number): number {
  let n =
    Math.imul(x | 0, 374761393) +
    Math.imul(z | 0, 668265263) +
    Math.imul(seedI, 1274126177)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n = n ^ (n >>> 16)
  return (n >>> 0) / 4294967296
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

/** Fractal Brownian motion, output roughly 0..1. Prefer 2–3 octaves. */
export function fbm(
  x: number,
  z: number,
  octaves = 3,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  const o = octaves | 0
  for (let i = 0; i < o; i++) {
    sum += amp * valueNoise(x * freq, z * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return norm > 0 ? sum / norm : 0
}

/** Ridged multifractal (0..1). Prefer 2–3 octaves. */
export function ridged(x: number, z: number, octaves = 3): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  const o = octaves | 0
  for (let i = 0; i < o; i++) {
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

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
