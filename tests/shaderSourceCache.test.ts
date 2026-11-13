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

it('leaves shaders untouched when there is nothing to reuse or one half mismatches', () => {
  const cache = new ShaderSourceCache()
  const fresh = { vertexShader: 'vertex', fragmentShader: 'fragment' }
  expect(cache.reuse(fresh)).toBe(false)
  expect(fresh).toEqual({ vertexShader: 'vertex', fragmentShader: 'fragment' })

  const first = { vertexShader: 'vertex', fragmentShader: 'fragment' }
  first.vertexShader += ':patched'; first.fragmentShader += ':patched'
  cache.remember('vertex', 'fragment', first)
  const wrongFragment = { vertexShader: 'vertex', fragmentShader: 'other' }
  expect(cache.reuse(wrongFragment)).toBe(false)
  expect(wrongFragment).toEqual({ vertexShader: 'vertex', fragmentShader: 'other' })
  const wrongVertex = { vertexShader: 'other', fragmentShader: 'fragment' }
  expect(cache.reuse(wrongVertex)).toBe(false)
  expect(wrongVertex).toEqual({ vertexShader: 'other', fragmentShader: 'fragment' })
})

it('round-trips empty sources and replaces the remembered pair on re-remember', () => {
  const cache = new ShaderSourceCache()
  const empty = { vertexShader: '', fragmentShader: '' }
  empty.vertexShader = ':patched-empty'; empty.fragmentShader = ':patched-empty'
  cache.remember('', '', empty)
  const second = { vertexShader: '', fragmentShader: '' }
  expect(cache.reuse(second)).toBe(true)
  expect(second.vertexShader).toBe(':patched-empty')
  expect(second.fragmentShader).toBe(':patched-empty')

  const next = { vertexShader: 'v2', fragmentShader: 'f2' }
  next.vertexShader += ':p2'; next.fragmentShader += ':p2'
  cache.remember('v2', 'f2', next)
  expect(cache.reuse({ vertexShader: '', fragmentShader: '' })).toBe(false)
  const third = { vertexShader: 'v2', fragmentShader: 'f2' }
  expect(cache.reuse(third)).toBe(true)
  expect(third.vertexShader).toBe('v2:p2')
})
