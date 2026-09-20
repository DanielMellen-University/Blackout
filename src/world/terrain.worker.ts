import { generateTerrainGeometry, terrainTransferables, CHUNK_SIZE } from './TerrainGeometry'
import { setWorldSeed } from './noise'
import { clearOpsPad, setOpsPad } from './terrainSample'
import type { TerrainBuildRequest, TerrainBuildReply } from './TerrainWorkerPool'

self.onmessage = (event: MessageEvent<TerrainBuildRequest>) => {
  const job = event.data
  setWorldSeed(job.seed)
  if (job.pad) setOpsPad(job.pad.x, job.pad.z, job.pad.y, job.pad.yaw)
  else clearOpsPad()
  const data = generateTerrainGeometry(job.cx * CHUNK_SIZE, job.cz * CHUNK_SIZE,
    job.lod, job.size, job.skirtEdges)
  self.postMessage({ id: job.id, generation: job.generation, data } satisfies TerrainBuildReply,
    { transfer: terrainTransferables(data) })
}
