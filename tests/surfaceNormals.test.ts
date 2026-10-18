import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three'
import { expect, it } from 'vitest'
import { computeSurfaceNormals } from '../src/world/SurfaceNormals'

it('matches Three.js normal bytes on steep, shared, degenerate and unused indexed vertices', () => {
  const geometry = new BufferGeometry(), positions: number[] = [], indices: number[] = []
  for (let i = 0; i < 300; i++) positions.push(Math.sin(i * .31) * 1000, Math.cos(i * .73) * 400, i * 17.5)
  for (let i = 0; i < 296; i++) indices.push(i, i + 1, i + 2, i + 1, i + 1, i + 3)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices)
  geometry.computeVertexNormals()
  for (let pass = 0; pass < 4; pass++) {
    for (let i = pass; i < 297; i += 7) geometry.getAttribute('position').setY(i, Math.sin(i + pass) * 800)
    const reference = geometry.clone(); reference.computeVertexNormals()
    computeSurfaceNormals(geometry)
    const actual = geometry.getAttribute('normal').array, expected = reference.getAttribute('normal').array
    expect(new Uint8Array(actual.buffer)).toEqual(new Uint8Array(expected.buffer))
    reference.dispose()
  }
  geometry.dispose()
})

it('retains the library path for nonindexed or normalized attributes', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3))
  computeSurfaceNormals(geometry)
  expect(geometry.getAttribute('normal').getY(0)).toBe(-1)
  geometry.setAttribute('normal', new BufferAttribute(new Int16Array(9), 3, true)); geometry.setIndex([0, 1, 2])
  const reference = geometry.clone(); reference.computeVertexNormals(); computeSurfaceNormals(geometry)
  expect(geometry.getAttribute('normal').array).toEqual(reference.getAttribute('normal').array)
  geometry.dispose(); reference.dispose()
})
