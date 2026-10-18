import { expect, it } from 'vitest'
import { ShaderSourceCache } from '../src/core/ShaderSourceCache'

it('shares only identical patched source and keeps each material uniform record independent', () => {
  const cache = new ShaderSourceCache(), first = { vertexShader: 'vertex', fragmentShader: 'fragment', uniforms: { rain: { value: .2 } } }
  expect(cache.reuse(first)).toBe(false)
  first.vertexShader += ':patched'; first.fragmentShader += ':patched'
  cache.remember('vertex', 'fragment', first)
  const second = { vertexShader: 'vertex', fragmentShader: 'fragment', uniforms: { rain: { value: .8 } } }
  expect(cache.reuse(second)).toBe(true)
  expect(second.vertexShader).toBe(first.vertexShader); expect(second.fragmentShader).toBe(first.fragmentShader)
  expect(second.uniforms.rain.value).toBe(.8); expect(first.uniforms.rain.value).toBe(.2)
  expect(cache.reuse({ vertexShader: 'other', fragmentShader: 'fragment' })).toBe(false)
  expect(cache.reuse({ vertexShader: 'vertex', fragmentShader: 'other' })).toBe(false)
})
