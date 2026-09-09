import { Mesh, Texture, type BufferGeometry, type Material, type Object3D } from 'three'

/** Dispose one owned scene subtree without double-disposing shared slots. */
export function disposeObjectTree(root: Object3D): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    const slots = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of slots) {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value)
      }
    }
  })
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
  for (const geometry of geometries) geometry.dispose()
  root.clear()
}
