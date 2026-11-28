import { BoxGeometry, DataTexture, Group, Mesh, MeshBasicMaterial, RGBAFormat, UnsignedByteType } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { disposeObjectTree } from '../src/core/dispose'

describe('scene resource disposal', () => {
  it('deduplicates shared geometry and material slots', () => {
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshBasicMaterial({ color: 0xffffff })
    const root = new Group()
    root.add(new Mesh(geometry, material), new Mesh(geometry, material))
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const materialDispose = vi.spyOn(material, 'dispose')

    disposeObjectTree(root)

    expect(geometryDispose).toHaveBeenCalledTimes(1)
    expect(materialDispose).toHaveBeenCalledTimes(1)
    expect(root.children).toHaveLength(0)
  })

  it('disposes texture maps owned by the subtree', () => {
    const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat, UnsignedByteType)
    const material = new MeshBasicMaterial({ map: texture })
    const root = new Group()
    root.add(new Mesh(new BoxGeometry(1, 1, 1), material))
    const textureDispose = vi.spyOn(texture, 'dispose')

    disposeObjectTree(root)

    expect(textureDispose).toHaveBeenCalledTimes(1)
  })

  it('disposes every slot of a multi-material mesh once and empties the root', () => {
    const geometry = new BoxGeometry(1, 1, 1)
    const shared = new MeshBasicMaterial()
    const side = new MeshBasicMaterial()
    const root = new Group()
    const child = new Group()
    child.add(new Mesh(geometry, [shared, side, shared]))
    root.add(new Mesh(geometry, shared), child)
    const sharedDispose = vi.spyOn(shared, 'dispose')
    const sideDispose = vi.spyOn(side, 'dispose')
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    disposeObjectTree(root)
    expect(sharedDispose).toHaveBeenCalledTimes(1)
    expect(sideDispose).toHaveBeenCalledTimes(1)
    expect(geometryDispose).toHaveBeenCalledTimes(1)
    expect(root.children).toHaveLength(0)
  })
})
