import { setWorldSeed } from './noise'
import { clearOpsPad, setOpsPad } from './terrainSample'
import { settlementForCell } from './SettlementPlan'
import { roadBetweenSettlements, regionalLinksForSettlement, compactRegionalRoadLink } from './RegionalRoads'
import type { RegionalRoadLink, RegionalRoadEndpoint } from './RegionalRoads'
import type { SettlementPlan, SettlementRoad } from './SettlementPlan'

interface BaseRequest {
  generation: number; seed: number
  pad: { x: number; y: number; z: number; yaw?: number } | null
}
export interface SettlementRequest extends BaseRequest {
  type: 'settlement'
  cx: number; cz: number; key: string; generation: number; seed: number
}
export interface RegionalRoadRequest extends BaseRequest {
  type: 'road'; key: string; from: RegionalRoadEndpoint; to: RegionalRoadEndpoint
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

self.onmessage = (event: MessageEvent<SettlementWorkerRequest>) => {
  const request = event.data
  setWorldSeed(request.seed)
  if (request.pad) setOpsPad(request.pad.x, request.pad.z, request.pad.y, request.pad.yaw ?? 0)
  else clearOpsPad()
  if (request.type === 'settlement') {
    const plan = settlementForCell(request.cx, request.cz)
    self.postMessage({ type: 'settlement', key: request.key, generation: request.generation, plan } satisfies SettlementWorkerReply)
  } else if (request.type === 'links') {
    const resolve = (cx: number, cz: number) => settlementForCell(cx, cz,
      request.protected.find(spec => spec.cx === cx && spec.cz === cz)?.kind)
    const source = resolve(request.cx, request.cz)
    const links: RegionalRoadLink[] = []
    if (source) for (const link of regionalLinksForSettlement(source, resolve)) {
      const compact = compactRegionalRoadLink(link)
      if (compact) links.push(compact)
    }
    self.postMessage({ type: 'links', key: request.key, generation: request.generation, links } satisfies SettlementWorkerReply)
  } else {
    const road = roadBetweenSettlements(request.from, request.to)
    self.postMessage({ type: 'road', key: request.key, generation: request.generation, road,
      fromId: request.from.id, toId: request.to.id } satisfies SettlementWorkerReply)
  }
}
