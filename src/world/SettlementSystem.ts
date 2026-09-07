import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group,
  InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Scene,
} from 'three'
import { FOG_FAR } from './TerrainSystem'
import { getOpsPad } from './terrainSample'
import { getWorldSeed } from './noise'
import { settlementForCell, SETTLEMENT_CELL_SIZE, type SettlementPlan } from './SettlementPlan'
import type { SettlementRequest } from './settlement.worker'

const LOAD_RADIUS = FOG_FAR
const DETAIL_RADIUS = 4200

const collisionRadii = new WeakMap<SettlementPlan, number>()

/** Oriented walls and roof volumes with a small jet margin. */
export function hitsSettlement(plan: SettlementPlan, x: number, y: number, z: number): boolean {
  let radius = collisionRadii.get(plan)
  if (radius === undefined) {
    radius = Math.max(0, ...plan.buildings.map(b => Math.hypot(b.x - plan.x, b.z - plan.z) + Math.hypot(b.width, b.depth) / 2 + 4))
    collisionRadii.set(plan, radius)
  }
  if (Math.hypot(x - plan.x, z - plan.z) > radius) return false
  return plan.buildings.some(b => {
    const dx = x - b.x, dz = z - b.z
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw)
    const lx = Math.abs(dx * c - dz * s), lz = Math.abs(dx * s + dz * c)
    if (y < b.y - 2 || lx > b.width / 2 + 2.6 || lz > b.depth / 2 + 2.6) return false
    const top = b.y + b.height
    const shape = b.shape ?? 'block'
    if (shape === 'tower' && (lx / (b.width / 2 + 2.6)) ** 2 + (lz / (b.depth / 2 + 2.6)) ** 2 > 1) return false
    if (shape === 'stepped' && y > b.y + b.height * .68 + 2
      && (lx > b.width * .34 + 2.6 || lz > b.depth * .36 + 2.6)) return false
    if (y <= top + 2) return true
    if (b.roof === 'pitched') {
      const roofHeight = Math.min(b.width, b.depth) * .3 * Math.max(0, 1 - Math.max(0, lx - 2) / (b.width / 2 + .6))
      return y <= top + roofHeight + 2
    }
    if (y <= top + 3.2) return true
    return plan.kind === 'city' && b.height > 250 && y <= top + b.height * .1 + 2
      && lx <= b.width * .24 + 2 && lz <= b.depth * .275 + 2
  })
}

function roofGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -.5, 0, -.5, .5, 0, -.5, 0, 1, -.5,
    -.5, 0, .5, .5, 0, .5, 0, 1, .5,
  ], 3))
  geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4])
  geometry.computeVertexNormals()
  return geometry
}

interface LoadedSettlement { plan: SettlementPlan; root: Group; detail: Group }

/** Independent scenery stream: shared geometry, instanced buildings, no shadow passes. */
export class SettlementSystem {
  readonly root = new Group()
  private readonly box = new BoxGeometry(1, 1, 1)
  private readonly tower = new CylinderGeometry(.5, .5, 1, 8)
  private readonly roof = roofGeometry()
  private readonly walls = new MeshStandardMaterial({ roughness: .82, metalness: .06 })
  private readonly roofs = new MeshStandardMaterial({ roughness: .95 })
  private readonly asphalt = new MeshStandardMaterial({ color: 0x4b4c48, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  private readonly loaded = new Map<string, LoadedSettlement>()
  private readonly checked = new Set<string>()
  private queue: { cx: number; cz: number; key: string }[] = []
  private lastCell = ''
  private worker: Worker | null = null
  private inFlight: SettlementRequest | null = null
  private ready: { key: string; plan: SettlementPlan }[] = []
  private generation = 0

  constructor(scene: Scene) {
    this.root.name = 'Settlements'
    scene.add(this.root)
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./settlement.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (event: MessageEvent<{ key: string; generation: number; plan: SettlementPlan | null }>) => {
        this.inFlight = null
        const { key, generation, plan } = event.data
        if (generation === this.generation && this.checked.has(key) && plan) this.ready.push({ key, plan })
      }
      this.worker.onerror = () => {
        this.worker?.terminate(); this.worker = null
        if (this.inFlight?.generation === this.generation) {
          this.checked.delete(this.inFlight.key)
          this.queue.unshift(this.inFlight)
        }
        this.inFlight = null
      }
    }
    // Facade windows live in the body shader, not thousands of separate meshes.
    this.walls.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        varying vec2 settlementUv;
        varying float settlementWall;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        settlementWall = 1.0 - abs(normal.y);
        settlementUv = uv * vec2(abs(normal.x) > .5 ? length(instanceMatrix[2].xyz) : length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec2 settlementUv;
        varying float settlementWall;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 grid = settlementUv / vec2(12.0, 10.0);
        vec2 pane = fract(grid);
        vec2 aa = max(fwidth(grid), vec2(.001));
        vec2 windowShape = smoothstep(vec2(.22, .3) - aa, vec2(.22, .3) + aa, pane)
          * (1.0 - smoothstep(vec2(.72, .75) - aa, vec2(.72, .75) + aa, pane));
        float windowMask = settlementWall * windowShape.x * windowShape.y
          * (1.0 - smoothstep(.2, .55, max(aa.x, aa.y)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.075, .12, .15), windowMask * .78);`)
    }
    this.walls.customProgramCacheKey = () => 'settlement-facades-v1'
  }

  get count(): number { return this.loaded.size }
  get buildingCount(): number {
    let count = 0
    for (const settlement of this.loaded.values()) count += settlement.plan.buildings.length
    return count
  }
  get pendingCount(): number { return this.queue.length + this.ready.length + (this.inFlight ? 1 : 0) }

  clearAll(): void {
    for (const settlement of this.loaded.values()) this.remove(settlement)
    this.loaded.clear()
    this.checked.clear()
    this.queue = []
    this.ready = []
    this.generation++
    this.lastCell = ''
  }

  dispose(): void {
    this.clearAll()
    this.worker?.terminate(); this.worker = null
    this.root.removeFromParent()
    this.box.dispose(); this.tower.dispose(); this.roof.dispose()
    this.walls.dispose(); this.roofs.dispose(); this.asphalt.dispose()
  }

  update(x: number, z: number): void {
    const cell = `${Math.floor(x / 1000)},${Math.floor(z / 1000)}`
    if (cell !== this.lastCell) {
      this.lastCell = cell
      const wanted = new Set<string>()
      const pending: { cx: number; cz: number; key: string; distance: number }[] = []
      const r = LOAD_RADIUS + SETTLEMENT_CELL_SIZE
      for (let cx = Math.floor((x - r) / SETTLEMENT_CELL_SIZE); cx <= Math.floor((x + r) / SETTLEMENT_CELL_SIZE); cx++) {
        for (let cz = Math.floor((z - r) / SETTLEMENT_CELL_SIZE); cz <= Math.floor((z + r) / SETTLEMENT_CELL_SIZE); cz++) {
          const key = `${cx},${cz}`
          const distance = Math.hypot((cx + .5) * SETTLEMENT_CELL_SIZE - x, (cz + .5) * SETTLEMENT_CELL_SIZE - z)
          if (distance > r) continue
          wanted.add(key)
          if (!this.checked.has(key)) pending.push({ cx, cz, key, distance })
        }
      }
      for (const key of this.checked) {
        if (wanted.has(key)) continue
        const settlement = this.loaded.get(key)
        if (settlement) { this.remove(settlement); this.loaded.delete(key) }
        this.checked.delete(key)
      }
      this.queue = pending.sort((a, b) => a.distance - b.distance)
    }
    const ready = this.ready.shift()
    if (ready && this.checked.has(ready.key)) this.loaded.set(ready.key, this.build(ready.plan))
    // Terrain suitability runs off the render thread. One in-flight request
    // bounds worker traffic; stale replies after reseeds are discarded.
    const job = this.inFlight ? undefined : this.queue.shift()
    if (job) {
      this.checked.add(job.key)
      if (this.worker) {
        this.inFlight = { ...job, generation: this.generation, seed: getWorldSeed(), pad: getOpsPad() }
        this.worker.postMessage(this.inFlight)
      } else {
        const plan = settlementForCell(job.cx, job.cz)
        if (plan) this.loaded.set(job.key, this.build(plan))
      }
    }
    for (const { plan, root, detail } of this.loaded.values()) {
      const distance = Math.hypot(plan.x - x, plan.z - z)
      root.visible = distance < LOAD_RADIUS + plan.radius
      detail.visible = distance < DETAIL_RADIUS + plan.radius
    }
  }

  hitObstacle(x: number, y: number, z: number): boolean {
    for (const { plan } of this.loaded.values()) if (hitsSettlement(plan, x, y, z)) return true
    return false
  }

  private build(plan: SettlementPlan): LoadedSettlement {
    const root = new Group(), detail = new Group()
    root.name = `${plan.kind}_${plan.id}`
    root.position.set(plan.x, plan.y, plan.z)
    root.add(detail)
    const transform = new Object3D(), color = new Color()
    const regular = plan.buildings.filter(b => (b.shape ?? 'block') !== 'tower' && b.shape !== 'stepped')
    const towers = plan.buildings.filter(b => b.shape === 'tower')
    const stepped = plan.buildings.filter(b => b.shape === 'stepped')
    const body = new InstancedMesh(this.box, this.walls, regular.length)
    const towerBodies = new InstancedMesh(this.tower, this.walls, towers.length)
    const stepBodies = new InstancedMesh(this.box, this.walls, stepped.length * 2)
    const pitched = plan.buildings.filter(b => b.roof === 'pitched')
    const flat = plan.buildings.filter(b => b.roof === 'flat')
    const gables = new InstancedMesh(this.roof, this.roofs, pitched.length)
    const crowns = flat.filter(b => plan.kind === 'city' && b.height > 250)
    const caps = new InstancedMesh(this.box, this.roofs, flat.length + crowns.length)
    const put = (mesh: InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, tint: number) => {
      transform.position.set(x - plan.x, y - plan.y, z - plan.z)
      transform.scale.set(w, h, d); transform.rotation.set(0, yaw, 0); transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
      mesh.setColorAt(index, color.setHex(tint))
    }
    regular.forEach((b, i) => put(body, i, b.x, b.y + b.height / 2, b.z, b.width, b.height, b.depth, b.yaw, b.wallColor))
    towers.forEach((b, i) => put(towerBodies, i, b.x, b.y + b.height / 2, b.z, b.width, b.height, b.depth, b.yaw, b.wallColor))
    stepped.forEach((b, i) => {
      put(stepBodies, i * 2, b.x, b.y + b.height * .34, b.z, b.width, b.height * .68, b.depth, b.yaw, b.wallColor)
      put(stepBodies, i * 2 + 1, b.x, b.y + b.height * .84, b.z, b.width * .68, b.height * .32, b.depth * .72, b.yaw, b.wallColor)
    })
    pitched.forEach((b, i) => put(gables, i, b.x, b.y + b.height, b.z, b.width + 1.2, Math.min(b.width, b.depth) * .3, b.depth + 1.2, b.yaw, b.roofColor))
    flat.forEach((b, i) => {
      const topScaleX = b.shape === 'stepped' ? .68 : b.shape === 'tower' ? .72 : 1
      const topScaleZ = b.shape === 'stepped' ? .72 : b.shape === 'tower' ? .72 : 1
      put(caps, i, b.x, b.y + b.height + .6, b.z, b.width * topScaleX + .5, 1.2,
        b.depth * topScaleZ + .5, b.yaw, b.roofColor)
    })
    crowns.forEach((b, i) => put(caps, flat.length + i, b.x, b.y + b.height + b.height * .05, b.z,
      b.width * .48, b.height * .1, b.depth * .55, b.yaw, b.roofColor))
    for (const mesh of [body, towerBodies, stepBodies, gables, caps]) {
      if (!mesh.count) { mesh.dispose(); continue }
      mesh.computeBoundingSphere()
      // Roof silhouettes stay visible at distance too; only ground detail is culled.
      root.add(mesh)
    }
    const positions: number[] = []
    for (const road of plan.roads) {
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1], b = road.points[i]
        const length = Math.hypot(b.x - a.x, b.z - a.z)
        if (!length) continue
        const nx = -(b.z - a.z) / length * road.width / 2
        const nz = (b.x - a.x) / length * road.width / 2
        // The worker has already validated and sampled both road shoulders.
        const vertices = [
          { x: a.leftX ?? a.x + nx, z: a.leftZ ?? a.z + nz, y: a.leftY ?? a.y },
          { x: a.rightX ?? a.x - nx, z: a.rightZ ?? a.z - nz, y: a.rightY ?? a.y },
          { x: b.leftX ?? b.x + nx, z: b.leftZ ?? b.z + nz, y: b.leftY ?? b.y },
          { x: b.rightX ?? b.x - nx, z: b.rightZ ?? b.z - nz, y: b.rightY ?? b.y },
        ]
        for (const index of [0, 2, 1, 1, 2, 3]) {
          const v = vertices[index]
          positions.push(v.x - plan.x, v.y - plan.y, v.z - plan.z)
        }
      }
    }
    if (positions.length) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometry.computeVertexNormals()
      const mesh = new Mesh(geometry, this.asphalt)
      mesh.name = 'SettlementRoads'
      detail.add(mesh)
    }
    this.root.add(root)
    return { root, detail, plan }
  }

  private remove(settlement: LoadedSettlement): void {
    settlement.root.removeFromParent()
    settlement.root.traverse(object => {
      if (object instanceof InstancedMesh) object.dispose()
      else if (object instanceof Mesh) object.geometry.dispose()
    })
  }
}
