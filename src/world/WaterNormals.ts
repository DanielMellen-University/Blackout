import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat } from 'three'

/** One small seamless, aperiodic-looking ripple field shared by every water body. */
function hash(x: number, y: number): number {
  let n = Math.imul(x & 15, 374761393) + Math.imul(y & 15, 668265263) + 912731
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
function field(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fade = (v: number) => v * v * v * (v * (v * 6 - 15) + 10)
  const u = fade(x - ix), v = fade(y - iy)
  const a = hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u
  const b = hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u
  return a * (1 - v) + b * v
}
const size = 128
const pixels = new Uint8Array(size * size * 4)
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const u = x / 8, v = y / 8, i = (y * size + x) * 4
  pixels[i] = Math.round(127.5 + (field(u + .2, v) - field(u - .2, v)) * 127)
  pixels[i + 1] = Math.round(127.5 + (field(u, v + .2) - field(u, v - .2)) * 127)
  pixels[i + 2] = 255
  pixels[i + 3] = 255
}
export const waterNormals = new DataTexture(pixels, size, size, RGBAFormat)
waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping
waterNormals.magFilter = LinearFilter
waterNormals.minFilter = LinearMipmapLinearFilter
waterNormals.generateMipmaps = true
waterNormals.needsUpdate = true
