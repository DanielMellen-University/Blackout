import type { OperationStageId } from './identity'
import type { EnergyChoice, RouteChoice } from './choices'
import { OPERATION_TERRAIN } from './terrain'

export interface StageWeights {
  low: number
  terrain: number
  speed: number
}

const FLOOR = OPERATION_TERRAIN.baseHeight

/** Absolute altitude for the briefed band. Valley stays low. Ridge climbs. */
export function stageAltitude(
  id: OperationStageId,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
): number {
  if (id === 'ingress') return FLOOR + 200
  if (id === 'transit') return route === 'ridge' ? FLOOR + 400 : FLOOR + 90
  return energy === 'commit' ? FLOOR + 280 : FLOOR + 110
}

/** Seconds allowed for the leg. Valley and commit are tighter. */
export function stageAllowance(
  id: OperationStageId,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
): number {
  if (id === 'ingress') return 22
  if (id === 'transit') return route === 'ridge' ? 20 : 16
  return energy === 'commit' ? 14 : 22
}

/** Flying-bonus weights. Valley pays for being low. Commit pays for speed. */
export function stageWeights(
  id: OperationStageId,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
): StageWeights {
  if (id === 'ingress') return { low: 1, terrain: 1, speed: 1 }
  if (id === 'transit') {
    return route === 'ridge'
      ? { low: 0.2, terrain: 0.3, speed: 1.4 }
      : { low: 1.6, terrain: 1.5, speed: 0.6 }
  }
  return energy === 'commit'
    ? { low: 0.4, terrain: 0.5, speed: 1.5 }
    : { low: 1.3, terrain: 1.2, speed: 0.5 }
}

/** Throttle the scripted pilot holds on this leg. */
export function stageThrottle(
  id: OperationStageId,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
): number {
  if (id === 'ingress') return 0.5
  if (id === 'transit') return route === 'ridge' ? 0.78 : 0.42
  return energy === 'commit' ? 0.8 : 0.32
}

/** Commit burns nitro on the egress leg, the stage that follows that decision. */
export function stageBoost(id: OperationStageId, energy: EnergyChoice | null): boolean {
  return id === 'egress' && energy === 'commit'
}
