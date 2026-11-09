import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  type Material,
} from 'three'
import type { EnergyChoice, RouteChoice } from './choices'
import { buildOperationPlan, stageSpec, type StageSpec } from './plan'
import type { OperationPhase } from './attempt'
import { stageStartZ } from './layout'

export const OPERATION_BAND_WIDTH_M = 160
export const OPERATION_BAND_HEIGHT_M = 80
const BAND_THICKNESS_M = 2
const VISUAL_LEAD_M = 40
const GATE_RADIUS_M = 38 * 1.5
const GATE_TUBE_M = 1.15 * 1.5
const POST_HEIGHT_M = 180

export type OperationMarkerKind = 'live' | 'valley' | 'ridge' | 'conserve' | 'commit'

export interface OperationMarkerGate {
  x: number
  y: number
  z: number
  kind: OperationMarkerKind
}

export interface OperationMarkerBand {
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  kind: OperationMarkerKind
  side: 'left' | 'right'
}

export interface OperationMarkerLayout {
  gates: OperationMarkerGate[]
  bands: OperationMarkerBand[]
}

const COLORS: Record<OperationMarkerKind, number> = {
  live: 0x3dcea8,
  valley: 0x67e8f9,
  ridge: 0xf0b429,
  conserve: 0x8fb8d8,
  commit: 0xff7a45,
}

interface ShownStage {
  spec: StageSpec
  kind: OperationMarkerKind
  lead: boolean
}

function shownStages(
  seed: number,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
  phase: OperationPhase,
): ShownStage[] {
  if (phase === 'ingress') {
    return [{ spec: stageSpec(buildOperationPlan(seed, null, null), 'ingress'), kind: 'live', lead: true }]
  }
  if (phase === 'route-choice') {
    return [
      { spec: stageSpec(buildOperationPlan(seed, 'valley', null), 'transit'), kind: 'valley', lead: false },
      { spec: stageSpec(buildOperationPlan(seed, 'ridge', null), 'transit'), kind: 'ridge', lead: false },
    ]
  }
  if (phase === 'transit') {
    return [{ spec: stageSpec(buildOperationPlan(seed, route, null), 'transit'), kind: 'live', lead: false }]
  }
  if (phase === 'energy-choice') {
    return [
      { spec: stageSpec(buildOperationPlan(seed, route, 'conserve'), 'egress'), kind: 'conserve', lead: false },
      { spec: stageSpec(buildOperationPlan(seed, route, 'commit'), 'egress'), kind: 'commit', lead: false },
    ]
  }
  if (phase === 'egress' || phase === 'complete') {
    return [{ spec: stageSpec(buildOperationPlan(seed, route, energy), 'egress'), kind: 'live', lead: false }]
  }
  return []
}

function bandsFor(stage: ShownStage): OperationMarkerBand[] {
  const start = stage.lead
    ? stageStartZ(stage.spec.index) - VISUAL_LEAD_M
    : stageStartZ(stage.spec.index) + VISUAL_LEAD_M
  const end = stage.spec.endZ
  const half = OPERATION_BAND_WIDTH_M / 2
  const shared = {
    y: stage.spec.altitudeM,
    z: (start + end) / 2,
    length: end - start,
    width: BAND_THICKNESS_M,
    height: OPERATION_BAND_HEIGHT_M,
    kind: stage.kind,
  }
  return [
    { ...shared, x: stage.spec.lateralM - half, side: 'left' },
    { ...shared, x: stage.spec.lateralM + half, side: 'right' },
  ]
}

/** Gates and the briefed altitude slab for the stage the player can see. */
export function operationMarkerLayout(
  seed: number,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
  phase: OperationPhase,
): OperationMarkerLayout {
  const stages = shownStages(seed, route, energy, phase)
  const gates: OperationMarkerGate[] = []
  const bands: OperationMarkerBand[] = []
  for (const stage of stages) {
    for (const gate of stage.spec.gates) {
      gates.push({ x: gate.x, y: gate.y, z: gate.z, kind: stage.kind })
    }
    bands.push(...bandsFor(stage))
  }
  return { gates, bands }
}

function material(kind: OperationMarkerKind, solid: boolean): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: COLORS[kind],
    transparent: true,
    opacity: solid ? 0.92 : 0.38,
    side: DoubleSide,
    depthWrite: false,
    fog: false,
  })
}

/** World-space rings, posts and the altitude band for the live operation. */
export class OperationCourseMarkers {
  readonly root = new Group()
  private key = ''
  private readonly gateGeometry = new TorusGeometry(GATE_RADIUS_M, GATE_TUBE_M, 8, 28)
  private readonly postGeometry = new BoxGeometry(3, POST_HEIGHT_M, 3)
  private readonly materials: Material[] = []

  constructor() {
    this.root.name = 'OperationCourse'
    this.root.visible = false
    this.root.frustumCulled = false
  }

  sync(seed: number, route: RouteChoice | null, energy: EnergyChoice | null, phase: string): void {
    if (phase !== 'ingress' && phase !== 'route-choice' && phase !== 'transit' && phase !== 'energy-choice' && phase !== 'egress' && phase !== 'complete') {
      return
    }
    const key = `${seed}|${route ?? ''}|${energy ?? ''}|${phase}`
    if (key === this.key) return
    this.key = key
    this.rebuild(operationMarkerLayout(seed, route, energy, phase))
    this.root.visible = true
  }

  hide(): void {
    this.root.visible = false
    this.key = ''
  }

  dispose(): void {
    this.clearMeshes()
    this.gateGeometry.dispose()
    this.postGeometry.dispose()
    for (const item of this.materials) item.dispose()
    this.materials.length = 0
    this.root.removeFromParent()
  }

  private rebuild(layout: OperationMarkerLayout): void {
    this.clearMeshes()
    for (const gate of layout.gates) {
      const ringMaterial = material(gate.kind, true)
      const postMaterial = material(gate.kind, false)
      this.materials.push(ringMaterial, postMaterial)
      const ring = new Mesh(this.gateGeometry, ringMaterial)
      ring.name = 'operation-gate'
      ring.position.set(gate.x, gate.y, gate.z)
      ring.frustumCulled = false
      ring.renderOrder = 2
      const post = new Mesh(this.postGeometry, postMaterial)
      post.name = 'operation-post'
      post.position.set(gate.x, gate.y, gate.z)
      post.frustumCulled = false
      post.renderOrder = 2
      this.root.add(ring, post)
    }
    for (const band of layout.bands) {
      const bandMaterial = material(band.kind, false)
      this.materials.push(bandMaterial)
      const mesh = new Mesh(new BoxGeometry(band.width, band.height, band.length), bandMaterial)
      mesh.name = 'operation-band'
      mesh.position.set(band.x, band.y, band.z)
      mesh.frustumCulled = false
      mesh.renderOrder = 1
      this.root.add(mesh)
    }
    this.root.updateMatrixWorld(true)
  }

  private clearMeshes(): void {
    for (const child of [...this.root.children]) {
      if (child instanceof Mesh && child.geometry !== this.gateGeometry && child.geometry !== this.postGeometry) {
        child.geometry.dispose()
      }
      child.removeFromParent()
    }
    for (const item of this.materials) item.dispose()
    this.materials.length = 0
  }
}
