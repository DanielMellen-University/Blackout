import { describe, expect, it } from 'vitest'
import { RepeatWrapping } from 'three'
import { waterNormals } from '../src/world/WaterNormals'

const size = 128
const data = waterNormals.image.data as Uint8Array
const px = (x: number, y: number, c: number) => data[(((y + size) % size) * size + (x + size) % size) * 4 + c]!

describe('shared water ripple normal texture', () => {
  it('is a repeating 128 px RGBA map with an upward blue channel', () => {
    expect(waterNormals.image.width).toBe(size)
    expect(waterNormals.image.height).toBe(size)
    expect(waterNormals.wrapS).toBe(RepeatWrapping)
    expect(waterNormals.wrapT).toBe(RepeatWrapping)
    for (let i = 2; i < data.length; i += 4) expect(data[i]).toBe(255)
  })

  it('tiles without a seam at the wrap edges', () => {
    let worstWrap = 0, worstInside = 0
    for (let i = 0; i < size; i++) for (const c of [0, 1]) {
      worstWrap = Math.max(worstWrap, Math.abs(px(0, i, c) - px(size - 1, i, c)), Math.abs(px(i, 0, c) - px(i, size - 1, c)))
      for (let j = 1; j < size; j++) worstInside = Math.max(worstInside, Math.abs(px(j, i, c) - px(j - 1, i, c)), Math.abs(px(i, j, c) - px(i, j - 1, c)))
    }
    expect(worstWrap).toBeLessThanOrEqual(worstInside)
  })

  it('keeps tilt centred so ripples do not lean one way', () => {
    let red = 0, green = 0
    for (let i = 0; i < data.length; i += 4) { red += data[i]!; green += data[i + 1]! }
    expect(Math.abs(red / (size * size) - 127.5)).toBeLessThan(2)
    expect(Math.abs(green / (size * size) - 127.5)).toBeLessThan(2)
  })
})
