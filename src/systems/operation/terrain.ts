import type { TerrainProfile } from '../../world/TerrainProfile'

/**
 * Flat dry desert used by the operation harness.
 * Relief stays small so a scripted altitude band remains a real clearance.
 */
export const OPERATION_TERRAIN: TerrainProfile = {
  theme: 'desert-run',
  landscapeRevision: 11037,
  routeRevision: 11037,
  originX: 0,
  originZ: 0,
  yaw: 0,
  baseHeight: 200,
  relief: 40,
  valleyHalfWidth: 800,
  phase: 0,
  dry: true,
}
