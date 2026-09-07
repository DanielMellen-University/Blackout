import { setWorldSeed } from './noise'
import { clearOpsPad, setOpsPad } from './terrainSample'
import { settlementForCell } from './SettlementPlan'

export interface SettlementRequest {
  cx: number; cz: number; key: string; generation: number; seed: number
  pad: { x: number; y: number; z: number } | null
}

self.onmessage = (event: MessageEvent<SettlementRequest>) => {
  const request = event.data
  setWorldSeed(request.seed)
  if (request.pad) setOpsPad(request.pad.x, request.pad.z, request.pad.y)
  else clearOpsPad()
  const plan = settlementForCell(request.cx, request.cz)
  self.postMessage({ key: request.key, generation: request.generation, plan })
}
