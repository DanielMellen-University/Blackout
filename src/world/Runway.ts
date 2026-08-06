import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'

/** Simple asphalt strip with centerline and threshold markings. */
export function createRunway(): Group {
  const root = new Group()
  root.name = 'Runway'

  const length = 120
  const width = 18

  const asphalt = new Mesh(
    new PlaneGeometry(width, length),
    new MeshStandardMaterial({
      color: 0x2a2e32,
      roughness: 0.9,
      metalness: 0.05,
      side: DoubleSide,
    }),
  )
  asphalt.rotation.x = -Math.PI / 2
  asphalt.receiveShadow = true
  root.add(asphalt)

  // Centerline dashes
  const dashMat = new MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.85 })
  const dashGeo = new BoxGeometry(0.35, 0.04, 4)
  for (let z = -length / 2 + 6; z < length / 2 - 4; z += 10) {
    const dash = new Mesh(dashGeo, dashMat)
    dash.position.set(0, 0.03, z)
    root.add(dash)
  }

  // Threshold bars
  const barMat = new MeshStandardMaterial({ color: 0xf5f5f0 })
  for (const z of [-length / 2 + 4, length / 2 - 4] as const) {
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue
      const bar = new Mesh(new BoxGeometry(0.9, 0.04, 2.5), barMat)
      bar.position.set(i * 1.15, 0.03, z)
      root.add(bar)
    }
  }

  // Edge lights (static emissive dots)
  const lightMat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xaaccff,
    emissiveIntensity: 0.8,
  })
  const lightGeo = new BoxGeometry(0.25, 0.12, 0.25)
  for (let z = -length / 2; z <= length / 2; z += 8) {
    for (const x of [-width / 2 + 0.4, width / 2 - 0.4] as const) {
      const light = new Mesh(lightGeo, lightMat)
      light.position.set(x, 0.06, z)
      root.add(light)
    }
  }

  return root
}
