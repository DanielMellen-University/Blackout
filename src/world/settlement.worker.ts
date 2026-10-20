import { setTerrainProfile, type TerrainProfile } from './TerrainProfile'
import { setWorldSeed } from './noise'
import { clearOpsPad, setOpsPad } from './terrainSample'
import { settlementForCell } from './SettlementPlan'
import { roadBetweenSettlements, buildableRegionalLinksForSettlement } from './RegionalRoads'
import { RoadProfileCache } from './RoadProfileCache'
import type { RegionalRoadLink, RegionalRoadEndpoint } from './RegionalRoads'
import type { SettlementPlan, SettlementRoad } from './SettlementPlan'

interface BaseRequest {
  terrainProfile?: Readonly<TerrainProfile> | null
  generation: number; seed: number
  pad: { x: number; y: number; z: number; yaw?: number } | null
}
export interface SettlementRequest extends BaseRequest {
  type: 'settlement'
  cx: number; cz: number; key: string; generation: number; seed: number
}
export interface RegionalRoadRequest extends BaseRequest {
  type: 'road'; key: string; from: RegionalRoadEndpoint; to: RegionalRoadEndpoint
  protected: readonly ProtectedSettlementSpec[]
}
export interface ProtectedSettlementSpec { cx: number; cz: number; kind: 'city' | 'village' }
export interface SettlementLinksRequest extends BaseRequest {
  type: 'links'; key: string; cx: number; cz: number; x: number; z: number; kind: 'city' | 'village'
  protected: readonly ProtectedSettlementSpec[]
}
export type SettlementWorkerRequest = SettlementRequest | RegionalRoadRequest | SettlementLinksRequest
export type SettlementWorkerReply =
  | { type: 'settlement'; key: string; generation: number; plan: SettlementPlan | null }
  | { type: 'links'; key: string; generation: number; links: RegionalRoadLink[] }
  | { type: 'road'; key: string; generation: number; road: SettlementRoad | null; fromId: string; toId: string }

const roadProfiles = new RoadProfileCache()
let roadWorldContext = ''

self.onmessage = (event: MessageEvent<SettlementWorkerRequest>) => {
  const request = event.data
  setTerrainProfile(request.terrainProfile ?? null)
  setWorldSeed(request.seed)
  if (request.pad) setOpsPad(request.pad.x, request.pad.z, request.pad.y, request.pad.yaw ?? 0)
  else clearOpsPad()
  const worldContext = JSON.stringify([request.generation, request.seed, request.terrainProfile,
    request.pad && [request.pad.x, request.pad.y, request.pad.z, request.pad.yaw ?? 0]])
  if (worldContext !== roadWorldContext) {
    roadWorldContext = worldContext
    roadProfiles.setContext(worldContext)
  }
  if (request.type === 'settlement') {
    const plan = settlementForCell(request.cx, request.cz)
    self.postMessage({ type: 'settlement', key: request.key, generation: request.generation, plan } satisfies SettlementWorkerReply)
  } else {
    // Protected descriptors are set-like. Normalize their order and pad yaw so
    // equivalent requests can reuse work; any world/reset/site change clears it.
    roadProfiles.setContext(JSON.stringify([worldContext,
      [...request.protected].sort((a, b) => a.cx - b.cx || a.cz - b.cz || a.kind.localeCompare(b.kind))]))
    const resolve = (cx: number, cz: number) => settlementForCell(cx, cz,
      request.protected.find(spec => spec.cx === cx && spec.cz === cz)?.kind)
    const protectedPlans: SettlementPlan[] = []
    for (const spec of request.protected) {
      const plan = resolve(spec.cx, spec.cz)
      if (plan) protectedPlans.push(plan)
    }
    const profile = (link: RegionalRoadLink) => roadProfiles.getOrBuild(link, () =>
      roadBetweenSettlements(link.from, link.to, resolve, protectedPlans))
    if (request.type === 'links') {
      const source = resolve(request.cx, request.cz)
      const links = source ? buildableRegionalLinksForSettlement(source, resolve, protectedPlans, profile) : []
      self.postMessage({ type: 'links', key: request.key, generation: request.generation, links } satisfies SettlementWorkerReply)
    } else {
      const road = profile(request)
      self.postMessage({ type: 'road', key: request.key, generation: request.generation, road,
        fromId: request.from.id, toId: request.to.id } satisfies SettlementWorkerReply)
    }
  }
}
