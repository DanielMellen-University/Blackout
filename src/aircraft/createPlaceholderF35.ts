import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three'

/**
 * Procedural F-35-inspired silhouette for Phase 0.
 * Drop a real GLB at `public/models/f35.glb` and load it via Aircraft.loadModel().
 *
 * Units: ~1 unit ≈ 1 meter. Approx length ~15 m along +Z (nose forward).
 */
export function createPlaceholderF35(): Group {
  const root = new Group()
  root.name = 'F35Placeholder'

  const bodyMat = new MeshStandardMaterial({
    color: 0x5a6570,
    metalness: 0.65,
    roughness: 0.38,
  })
  const darkMat = new MeshStandardMaterial({
    color: 0x2a3038,
    metalness: 0.5,
    roughness: 0.45,
  })
  const canopyMat = new MeshStandardMaterial({
    color: 0x1a2838,
    metalness: 0.9,
    roughness: 0.12,
    transparent: true,
    opacity: 0.85,
  })
  const accentMat = new MeshStandardMaterial({
    color: 0x3d4a56,
    metalness: 0.55,
    roughness: 0.4,
  })

  // Fuselage
  const fuselage = new Mesh(new CylinderGeometry(0.55, 0.7, 9.5, 12), bodyMat)
  fuselage.rotation.x = Math.PI / 2
  fuselage.position.z = -0.5
  fuselage.castShadow = true
  root.add(fuselage)

  // Nose cone
  const nose = new Mesh(new ConeGeometry(0.55, 2.4, 12), bodyMat)
  nose.rotation.x = -Math.PI / 2
  nose.position.z = 5.5
  nose.castShadow = true
  root.add(nose)

  // Canopy
  const canopy = new Mesh(new CylinderGeometry(0.42, 0.5, 2.2, 10, 1, false, 0, Math.PI), canopyMat)
  canopy.rotation.x = Math.PI / 2
  canopy.rotation.z = Math.PI
  canopy.position.set(0, 0.45, 2.2)
  root.add(canopy)

  // Main wings (slight forward sweep via scale/position)
  const wingGeo = new BoxGeometry(10.5, 0.12, 3.2)
  const wings = new Mesh(wingGeo, bodyMat)
  wings.position.set(0, -0.05, -0.8)
  wings.castShadow = true
  root.add(wings)

  // Wing LE taper blocks
  const leLeft = new Mesh(new BoxGeometry(4.2, 0.1, 1.4), accentMat)
  leLeft.position.set(-3.2, -0.02, 0.6)
  leLeft.rotation.y = 0.35
  root.add(leLeft)
  const leRight = leLeft.clone()
  leRight.position.x *= -1
  leRight.rotation.y *= -1
  root.add(leRight)

  // Horizontal tails
  const hStab = new Mesh(new BoxGeometry(4.2, 0.1, 1.4), bodyMat)
  hStab.position.set(0, 0.15, -5.2)
  hStab.castShadow = true
  root.add(hStab)

  // Twin vertical tails (canted outward — F-35-ish)
  const vStabGeo = new BoxGeometry(0.12, 1.8, 1.6)
  const vLeft = new Mesh(vStabGeo, darkMat)
  vLeft.position.set(-0.85, 0.95, -4.6)
  vLeft.rotation.z = 0.28
  vLeft.castShadow = true
  root.add(vLeft)
  const vRight = vLeft.clone()
  vRight.position.x *= -1
  vRight.rotation.z *= -1
  root.add(vRight)

  // Intake blisters
  const intakeL = new Mesh(new BoxGeometry(0.7, 0.55, 2.4), darkMat)
  intakeL.position.set(-0.85, -0.35, 0.8)
  root.add(intakeL)
  const intakeR = intakeL.clone()
  intakeR.position.x *= -1
  root.add(intakeR)

  // Exhaust nozzle
  const nozzle = new Mesh(new CylinderGeometry(0.48, 0.42, 0.9, 10), darkMat)
  nozzle.rotation.x = Math.PI / 2
  nozzle.position.z = -5.6
  root.add(nozzle)

  // Simple gear legs (visual only)
  addGear(root, darkMat)

  // Face -Z as "forward" is common in some pipelines; we use +Z nose.
  // Ensure shadow casting on all meshes
  root.traverse((obj: Object3D) => {
    const mesh = obj as Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })

  return root
}

function addGear(root: Group, mat: MeshStandardMaterial): void {
  const strut = (x: number, z: number) => {
    const leg = new Mesh(new CylinderGeometry(0.05, 0.05, 0.9, 6), mat)
    leg.position.set(x, -0.85, z)
    root.add(leg)
    const wheel = new Mesh(new CylinderGeometry(0.18, 0.18, 0.12, 10), mat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, -1.25, z)
    root.add(wheel)
  }
  strut(0, 2.5)
  strut(-1.2, -0.5)
  strut(1.2, -0.5)
}
