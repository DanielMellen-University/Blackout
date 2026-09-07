import { setWorldSeed } from './noise'
import { clearOpsPad, setOpsPad } from './terrainSample'
import { settlementForCell } from './SettlementPlan'
import { roadBetweenSettlements } from './RegionalRoads'
import type { SettlementPlan, SettlementRoad } from './SettlementPlan'

interface BaseRequest {
  generation: number; seed: number
  pad: { x: number; y: number; z: number } | null
}
export interface SettlementRequest extends BaseRequest {
  type: 'settlement'
  cx: number; cz: number; key: string; generation: number; seed: number
}
export interface RegionalRoadRequest extends BaseRequest {
  type: 'road'; key: string; from: SettlementPlan; to: SettlementPlan
}
export type SettlementWorkerRequest = SettlementRequest | RegionalRoadRequest
export type SettlementWorkerReply =
  | { type: 'settlement'; key: string; generation: number; plan: SettlementPlan | null }
  | { type: 'road'; key: string; generation: number; road: SettlementRoad | null; fromId: string; toId: string }

self.onmessage = (event: MessageEvent<SettlementWorkerRequest>) => {
  const request = event.data
  setWorldSeed(request.seed)
  if (request.pad) setOpsPad(request.pad.x, request.pad.z, request.pad.y)
  else clearOpsPad()
  if (request.type === 'settlement') {
    const plan = settlementForCell(request.cx, request.cz)
    self.postMessage({ type: 'settlement', key: request.key, generation: request.generation, plan } satisfies SettlementWorkerReply)
  } else {
    const road = roadBetweenSettlements(request.from, request.to)
    self.postMessage({ type: 'road', key: request.key, generation: request.generation, road,
      fromId: request.from.id, toId: request.to.id } satisfies SettlementWorkerReply)
  }
}
