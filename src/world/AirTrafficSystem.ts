import {
  AdditiveBlending,
  BufferGeometry,
  BoxGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import type { RenderQuality } from '../core/RenderQuality'
import type { RadarLandmark } from '../systems/RadarSystem'

/** Fixed traffic pool. Distant silhouettes add life without growing the scene. */
export const AIR_TRAFFIC_COUNT = 6
export const AIR_TRAFFIC_CELL_SIZE_M = 10_000
export const AIR_TRAFFIC_UPDATE_INTERVAL_SEC = 1 / 12
export const AIR_TRAFFIC_MIN_DISTANCE_M = 900
export const AIR_TRAFFIC_MAX_DISTANCE_M = 8_000
export const AIR_TRAFFIC_ALERT_RANGE_M = 1_800
export const AIR_TRAFFIC_ALERT_VERTICAL_M = 520
export const AIR_TRAFFIC_BEACON_COUNT = AIR_TRAFFIC_COUNT

export interface TrafficAlert {
  readonly id: string
  readonly distance: number
  /** Signed world-space separation: positive means traffic is above the jet. */
  readonly verticalOffset: number
  readonly verticalSeparation: number
  readonly bearing: number
}

interface TrafficSlot {
  offsetX: number
  offsetZ: number
  radiusX: number
  radiusZ: number
  altitude: number
  verticalSpan: number
  angularVelocity: number
  phase: number
  pitchPhase: number
  scale: number
}

const _matrix = new Matrix4()
const _position = new Vector3()
const _scale = new Vector3()
const _quaternion = new Quaternion()
const _identity = new Quaternion()
const _euler = new Euler()
const trafficAlertValue = {
  id: '',
  distance: 0,
  verticalOffset: 0,
  verticalSeparation: 0,
  bearing: 0,
}

/** Return the deterministic traffic cell containing a world coordinate. */
export function trafficCellFor(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.floor(value / AIR_TRAFFIC_CELL_SIZE_M)
}

/** Keep the traffic simulation on its bounded visual update cadence. */
export function trafficStepSeconds(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0
  return Math.min(dt, AIR_TRAFFIC_UPDATE_INTERVAL_SEC * 2)
}

/** Pure distance gate used to hide silhouettes beyond the useful fog envelope. */
export function trafficInRange(distance: number): boolean {
  return Number.isFinite(distance) &&
    distance >= AIR_TRAFFIC_MIN_DISTANCE_M &&
    distance <= AIR_TRAFFIC_MAX_DISTANCE_M
}

/** Keep the proximity cue readable without exposing raw radians to the HUD. */
export function trafficAlertSide(bearing: number): 'LEFT' | 'RIGHT' | 'AHEAD' | 'BEHIND' {
  const safe = Number.isFinite(bearing) ? Math.atan2(Math.sin(bearing), Math.cos(bearing)) : 0
  if (Math.abs(safe) < Math.PI / 8) return 'AHEAD'
  if (Math.abs(safe) >= Math.PI * .875) return 'BEHIND'
  return safe > 0 ? 'RIGHT' : 'LEFT'
}

/** Keep vertical traffic guidance inside a readable deadband. */
export function trafficAlertVertical(verticalOffset: number, deadband = 80): 'ABOVE' | 'BELOW' | 'LEVEL' {
  const safe = Number.isFinite(verticalOffset) ? verticalOffset : 0
  const safeDeadband = Number.isFinite(deadband) && deadband >= 0 ? deadband : 80
  if (Math.abs(safe) <= safeDeadband) return 'LEVEL'
  return safe > 0 ? 'ABOVE' : 'BELOW'
}

/** Deterministic blink phase for pooled traffic anti-collision beacons. */
export function trafficBeaconVisible(elapsed: number, index: number): boolean {
  if (!Number.isFinite(elapsed) || !Number.isFinite(index) || index < 0) return false
  return Math.sin(elapsed * 4.2 + index * 1.73) > 0.35
}

/**
 * A pooled, deterministic set of distant silhouettes. Traffic is cosmetic:
 * it never collides with the aircraft and never enters mission scoring.
 */
export class AirTrafficSystem {
  readonly root = new Group()
  private readonly geometry: BufferGeometry
  private readonly material: MeshBasicMaterial
  private readonly mesh: InstancedMesh
  private readonly contrailGeometry: BoxGeometry
  private readonly contrailMaterial: MeshBasicMaterial
  private readonly contrailMesh: InstancedMesh
  private readonly beaconGeometry: SphereGeometry
  private readonly beaconMaterial: MeshBasicMaterial
  private readonly beaconMesh: InstancedMesh
  private readonly radarPool: RadarLandmark[] = Array.from(
    { length: AIR_TRAFFIC_COUNT },
    (_, index) => ({ x: 0, y: 0, z: 0, kind: 'traffic' as const, id: `traffic-${index}` }),
  )
  private readonly radarCache: RadarLandmark[] = []
  private readonly slots: TrafficSlot[] = Array.from(
    { length: AIR_TRAFFIC_COUNT },
    () => ({
      offsetX: 0,
      offsetZ: 0,
      radiusX: 1,
      radiusZ: 1,
      altitude: 900,
      verticalSpan: 40,
      angularVelocity: 0.02,
      phase: 0,
      pitchPhase: 0,
      scale: 1,
    }),
  )
  private seed = 0
  private baseY = 0
  private cellX = 0
  private cellZ = 0
  private anchorX = 0
  private anchorZ = 0
  private lastPlayerX = 0
  private lastPlayerZ = 0
  private elapsed = 0
  private accumulator = 0
  private activeCount = AIR_TRAFFIC_COUNT
  private activeContrailCount = AIR_TRAFFIC_COUNT
  private activeBeaconCount = AIR_TRAFFIC_BEACON_COUNT
  private revision = 0

  constructor(parent: Object3D) {
    this.root.name = 'AirTraffic'
    this.root.visible = false
    this.geometry = createTrafficGeometry()
    this.material = new MeshBasicMaterial({
      color: 0x9db7c6,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
    this.mesh = new InstancedMesh(this.geometry, this.material, AIR_TRAFFIC_COUNT)
    this.mesh.name = 'AirTrafficSilhouettes'
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.root.add(this.mesh)
    this.contrailGeometry = new BoxGeometry(1, 1, 1)
    this.contrailMaterial = new MeshBasicMaterial({
      color: 0xb9dce8,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      toneMapped: false,
    })
    this.contrailMesh = new InstancedMesh(this.contrailGeometry, this.contrailMaterial, AIR_TRAFFIC_COUNT)
    this.contrailMesh.name = 'AirTrafficContrails'
    this.contrailMesh.frustumCulled = false
    this.contrailMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.root.add(this.contrailMesh)
    this.beaconGeometry = new SphereGeometry(0.18, 6, 4)
    this.beaconMaterial = new MeshBasicMaterial({
      color: 0xff8b64,
      transparent: true,
      opacity: 0.82,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    this.beaconMesh = new InstancedMesh(this.beaconGeometry, this.beaconMaterial, AIR_TRAFFIC_BEACON_COUNT)
    this.beaconMesh.name = 'AirTrafficBeacons'
    this.beaconMesh.frustumCulled = false
    this.beaconMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.root.add(this.beaconMesh)
    parent.add(this.root)
    this.reset(0, 0, 0, 0)
  }

  get count(): number {
    return this.activeCount
  }

  get updateRevision(): number {
    return this.revision
  }

  /** Return a pooled nearby snapshot for the radar sweep. */
  getRadarLandmarks(x: number, z: number, maxRange: number): readonly RadarLandmark[] {
    const safeX = Number.isFinite(x) ? x : this.lastPlayerX
    const safeZ = Number.isFinite(z) ? z : this.lastPlayerZ
    const range = Number.isFinite(maxRange) ? Math.max(0, maxRange) : 0
    this.radarCache.length = 0
    for (let index = 0; index < this.activeCount; index += 1) {
      const contact = this.radarPool[index]!
      const distance = Math.hypot(contact.x - safeX, contact.z - safeZ)
      if (!trafficInRange(distance) || distance > range) continue
      this.radarCache.push(contact)
    }
    return this.radarCache
  }

  /** Return the nearest bounded traffic conflict for a one-shot pilot cue. */
  closestAlert(x: number, y: number, z: number, heading: number): TrafficAlert | null {
    const safeX = Number.isFinite(x) ? x : this.lastPlayerX
    const safeY = Number.isFinite(y) ? y : this.baseY
    const safeZ = Number.isFinite(z) ? z : this.lastPlayerZ
    const safeHeading = Number.isFinite(heading) ? heading : 0
    let bestDistance = Number.POSITIVE_INFINITY
    let best: RadarLandmark | null = null
    let bestVerticalOffset = 0
    let bestVertical = 0
    for (let index = 0; index < this.activeCount; index += 1) {
      const contact = this.radarPool[index]!
      const dx = contact.x - safeX
      const dz = contact.z - safeZ
      const distance = Math.hypot(dx, dz)
      const vertical = Math.abs(contact.y - safeY)
      if (
        !Number.isFinite(distance) ||
        !Number.isFinite(vertical) ||
        distance > AIR_TRAFFIC_ALERT_RANGE_M ||
        vertical > AIR_TRAFFIC_ALERT_VERTICAL_M ||
        distance >= bestDistance
      ) continue
      bestDistance = distance
      best = contact
      bestVerticalOffset = contact.y - safeY
      bestVertical = vertical
    }
    if (!best || !Number.isFinite(bestDistance)) return null
    trafficAlertValue.id = best.id ?? ''
    trafficAlertValue.distance = bestDistance
    trafficAlertValue.verticalOffset = Number.isFinite(bestVerticalOffset) ? bestVerticalOffset : 0
    trafficAlertValue.verticalSeparation = bestVertical
    trafficAlertValue.bearing = wrapAngle(Math.atan2(best.x - safeX, best.z - safeZ) - safeHeading)
    return trafficAlertValue
  }

  /** Rebuild only the fixed slot data when a world or traffic cell changes. */
  reset(seed: number, x: number, y: number, z: number): void {
    this.seed = Number.isFinite(seed) ? Math.trunc(seed) : 0
    this.baseY = Number.isFinite(y) ? y : 0
    this.elapsed = 0
    this.accumulator = 0
    this.cellX = trafficCellFor(x)
    this.cellZ = trafficCellFor(z)
    this.lastPlayerX = Number.isFinite(x) ? x : 0
    this.lastPlayerZ = Number.isFinite(z) ? z : 0
    this.regenerateCell(this.cellX, this.cellZ)
    this.renderInstances(this.lastPlayerX, this.lastPlayerZ)
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible === true
  }

  /** Keep low-end devices at three silhouettes while High gets the full pool. */
  setRenderQuality(quality: RenderQuality): void {
    this.activeCount = quality === 'low' ? 3 : quality === 'balanced' ? 5 : AIR_TRAFFIC_COUNT
    this.activeContrailCount = quality === 'low' ? 0 : this.activeCount
    this.activeBeaconCount = quality === 'low' ? 0 : this.activeCount
    this.mesh.count = this.activeCount
    this.contrailMesh.count = this.activeContrailCount
    this.beaconMesh.count = this.activeBeaconCount
    this.renderInstances(this.lastPlayerX, this.lastPlayerZ)
  }

  /** Advance traffic at 12 Hz, independent of render refresh rate. */
  update(x: number, z: number, dt: number): void {
    const safeX = Number.isFinite(x) ? x : this.anchorX
    const safeZ = Number.isFinite(z) ? z : this.anchorZ
    this.lastPlayerX = safeX
    this.lastPlayerZ = safeZ
    const nextCellX = trafficCellFor(safeX)
    const nextCellZ = trafficCellFor(safeZ)
    if (nextCellX !== this.cellX || nextCellZ !== this.cellZ) {
      this.cellX = nextCellX
      this.cellZ = nextCellZ
      this.regenerateCell(nextCellX, nextCellZ)
      this.accumulator = 0
      this.renderInstances(safeX, safeZ)
      return
    }

    const safeDt = trafficStepSeconds(dt)
    if (safeDt <= 0) return
    this.accumulator += safeDt
    if (this.accumulator < AIR_TRAFFIC_UPDATE_INTERVAL_SEC) return
    const step = Math.min(this.accumulator, AIR_TRAFFIC_UPDATE_INTERVAL_SEC * 2)
    this.accumulator = 0
    this.elapsed += step
    this.renderInstances(safeX, safeZ)
  }

  dispose(): void {
    this.root.remove(this.mesh)
    this.root.remove(this.contrailMesh)
    this.root.remove(this.beaconMesh)
    this.geometry.dispose()
    this.material.dispose()
    this.contrailGeometry.dispose()
    this.contrailMaterial.dispose()
    this.beaconGeometry.dispose()
    this.beaconMaterial.dispose()
  }

  private regenerateCell(cellX: number, cellZ: number): void {
    this.anchorX = (cellX + 0.5) * AIR_TRAFFIC_CELL_SIZE_M
    this.anchorZ = (cellZ + 0.5) * AIR_TRAFFIC_CELL_SIZE_M
    for (let index = 0; index < this.slots.length; index += 1) {
      const slot = this.slots[index]!
      const random = (salt: number): number => trafficRandom(this.seed, cellX, cellZ, index, salt)
      slot.offsetX = (random(1) - 0.5) * 1_600
      slot.offsetZ = (random(2) - 0.5) * 1_600
      slot.radiusX = 1_700 + random(3) * 2_200
      slot.radiusZ = 1_700 + random(4) * 2_200
      slot.altitude = 750 + random(5) * 1_900
      slot.verticalSpan = 36 + random(6) * 90
      const speed = 78 + random(7) * 122
      slot.angularVelocity = speed / Math.max(slot.radiusX, slot.radiusZ)
      slot.phase = random(8) * Math.PI * 2
      slot.pitchPhase = random(9) * Math.PI * 2
      slot.scale = 0.72 + random(10) * 0.42
      this.radarPool[index]!.id = `traffic:${cellX}:${cellZ}:${index}`
    }
  }

  private renderInstances(playerX: number, playerZ: number): void {
    for (let index = 0; index < AIR_TRAFFIC_COUNT; index += 1) {
      const slot = this.slots[index]!
      if (index >= this.activeCount) {
        _matrix.makeScale(0, 0, 0)
        this.mesh.setMatrixAt(index, _matrix)
        this.contrailMesh.setMatrixAt(index, _matrix)
        this.beaconMesh.setMatrixAt(index, _matrix)
        continue
      }

      const phase = slot.phase + this.elapsed * slot.angularVelocity
      const sin = Math.sin(phase)
      const cos = Math.cos(phase)
      const x = this.anchorX + slot.offsetX + cos * slot.radiusX
      const z = this.anchorZ + slot.offsetZ + sin * slot.radiusZ
      const pitchWave = phase * 1.7 + slot.pitchPhase
      const y = this.baseY + slot.altitude + Math.sin(pitchWave) * slot.verticalSpan
      const contact = this.radarPool[index]!
      contact.x = x
      contact.y = y
      contact.z = z
      const distance = Math.hypot(x - playerX, z - playerZ)
      if (!trafficInRange(distance)) {
        _matrix.makeScale(0, 0, 0)
        this.mesh.setMatrixAt(index, _matrix)
        this.contrailMesh.setMatrixAt(index, _matrix)
        this.beaconMesh.setMatrixAt(index, _matrix)
        continue
      }

      const dx = -sin * slot.radiusX * slot.angularVelocity
      const dz = cos * slot.radiusZ * slot.angularVelocity
      const dy = Math.cos(pitchWave) * slot.verticalSpan * 1.7 * slot.angularVelocity
      const horizontalSpeed = Math.hypot(dx, dz)
      const yaw = Math.atan2(dx, dz)
      const pitch = Math.atan2(dy, Math.max(horizontalSpeed, 0.001))
      const roll = Math.sin(phase * 1.35 + slot.pitchPhase) * 0.045
      _position.set(x, y, z)
      _euler.set(pitch, yaw, roll, 'YXZ')
      _quaternion.setFromEuler(_euler)
      _scale.setScalar(slot.scale)
      _matrix.compose(_position, _quaternion, _scale)
      this.mesh.setMatrixAt(index, _matrix)
      const forwardX = Math.sin(yaw) * Math.cos(pitch)
      const forwardY = Math.sin(pitch)
      const forwardZ = Math.cos(yaw) * Math.cos(pitch)
      if (index < this.activeContrailCount) {
        _position.set(x - forwardX * 3.2, y - forwardY * 3.2, z - forwardZ * 3.2)
        _scale.set(0.16 * slot.scale, 0.12 * slot.scale, 2.6 + slot.scale * 1.4)
        _matrix.compose(_position, _quaternion, _scale)
        this.contrailMesh.setMatrixAt(index, _matrix)
      } else {
        _matrix.makeScale(0, 0, 0)
        this.contrailMesh.setMatrixAt(index, _matrix)
      }
      if (index < this.activeBeaconCount && trafficBeaconVisible(this.elapsed, index)) {
        const beaconX = x - forwardX * 2.4
        const beaconY = y + 0.12
        const beaconZ = z - forwardZ * 2.4
        _position.set(beaconX, beaconY, beaconZ)
        _scale.setScalar(0.9 + Math.sin(this.elapsed * 5 + index) * 0.18)
        _matrix.compose(_position, _identity, _scale)
        this.beaconMesh.setMatrixAt(index, _matrix)
      } else {
        _matrix.makeScale(0, 0, 0)
        this.beaconMesh.setMatrixAt(index, _matrix)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.contrailMesh.instanceMatrix.needsUpdate = true
    this.beaconMesh.instanceMatrix.needsUpdate = true
    this.revision += 1
  }
}

function createTrafficGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0.08, 2.2,
    -1.25, 0, -0.8,
    -0.4, 0, -1.8,
    0.4, 0, -1.8,
    1.25, 0, -0.8,
    0, -0.12, 2.2,
    -1.25, -0.12, -0.8,
    -0.4, -0.12, -1.8,
    0.4, -0.12, -1.8,
    1.25, -0.12, -0.8,
  ], 3))
  geometry.setIndex([
    0, 1, 2, 0, 2, 3, 0, 3, 4,
    5, 7, 6, 5, 8, 7, 5, 9, 8,
    0, 5, 6, 0, 6, 1,
    1, 6, 7, 1, 7, 2,
    2, 7, 8, 2, 8, 3,
    3, 8, 9, 3, 9, 4,
    4, 9, 5, 4, 5, 0,
  ])
  geometry.computeBoundingSphere()
  return geometry
}

function trafficRandom(seed: number, cellX: number, cellZ: number, index: number, salt: number): number {
  let value = seed | 0
  value ^= Math.imul(cellX, 0x45d9f3b)
  value ^= Math.imul(cellZ, 0x119de1f3)
  value ^= Math.imul(index + 1, 0x3449c1a7)
  value ^= Math.imul(salt + 1, 0x27d4eb2d)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}

function wrapAngle(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.atan2(Math.sin(value), Math.cos(value))
}
