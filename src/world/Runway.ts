import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'
import { createAirfieldLandmarks, freezeStaticAirfieldMeshes } from './Airfield'

const runwayLightMaterial = new WeakMap<Group, MeshStandardMaterial>()

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

  // Shared materials/geometries (many instances, one GPU program each)
  const dashMat = new MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.85 })
  const dashGeo = new BoxGeometry(0.35, 0.04, 4)
  for (let z = -length / 2 + 6; z < length / 2 - 4; z += 10) {
    const dash = new Mesh(dashGeo, dashMat)
    dash.position.set(0, 0.03, z)
    root.add(dash)
  }

  const barMat = new MeshStandardMaterial({ color: 0xf5f5f0 })
  const barGeo = new BoxGeometry(0.9, 0.04, 2.5)
  for (const z of [-length / 2 + 4, length / 2 - 4] as const) {
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue
      const bar = new Mesh(barGeo, barMat)
      bar.position.set(i * 1.15, 0.03, z)
      root.add(bar)
    }
  }

  const lightMat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xaaccff,
    emissiveIntensity: 0.8,
  })
  const runwayLights = new Group()
  runwayLights.name = 'RunwayLights'
  runwayLightMaterial.set(root, lightMat)
  root.add(runwayLights)
  const lightGeo = new BoxGeometry(0.25, 0.12, 0.25)
  for (let z = -length / 2; z <= length / 2; z += 8) {
    for (const x of [-width / 2 + 0.4, width / 2 - 0.4] as const) {
      const light = new Mesh(lightGeo, lightMat)
      light.position.set(x, 0.06, z)
      runwayLights.add(light)
    }
  }

  root.add(createAirfieldLandmarks())
  freezeStaticAirfieldMeshes(root)
  return root
}

/** Shared runway light response: subtle at day, readable at night. */
export function runwayLightIntensity(daylight: number): number {
  const t = Math.min(1, Math.max(0, daylight))
  return 0.18 + (1 - t) * 1.62
}

export function setRunwayDaylight(root: Group, daylight: number): void {
  const intensity = runwayLightIntensity(daylight)
  const shared = runwayLightMaterial.get(root)
  if (shared) {
    if (Math.abs(shared.emissiveIntensity - intensity) > 0.001) {
      shared.emissiveIntensity = intensity
    }
    return
  }
  // Keep the helper useful for externally assembled runway groups.
  const lights = root.getObjectByName('RunwayLights')
  if (!lights) return
  lights.traverse((object) => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return
    object.material.emissiveIntensity = intensity
  })
}
