import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group,
  InstancedMesh, MathUtils, Mesh, MeshStandardMaterial, Object3D, Scene,
} from 'three'
import { FOG_FAR } from './TerrainSystem'
import { getOpsPad } from './terrainSample'
import { getWorldSeed } from './noise'
import { settlementForCell, SETTLEMENT_CELL_SIZE, type SettlementPlan, type SettlementRoad } from './SettlementPlan'
import * as settlementPlanApi from './SettlementPlan'
import { regionalLinksForSettlement, regionalRoadKey, roadBetweenSettlements } from './RegionalRoads'
import type { SettlementWorkerReply, SettlementWorkerRequest } from './settlement.worker'

const LOAD_RADIUS = FOG_FAR
const DETAIL_RADIUS = 4200
const ROAD_LOAD_RADIUS = LOAD_RADIUS + 3000
const ROAD_KEEP_RADIUS = ROAD_LOAD_RADIUS + 5000

// Generation can be generous without letting a dense slice of the world turn
// into an unbounded set of instance buffers or road meshes around the player.
export const MAX_LOADED_SETTLEMENTS = 4
export const MAX_LOADED_BUILDINGS = 1500
/** Roads stream independently from settlement building roots. */
export const MAX_LOADED_REGIONAL_ROADS = 6

const collisionRadii = new WeakMap<SettlementPlan, number>()

/** Lower values are protected spawn landmarks and should stream first. */
export function settlementLoadPriority(plan: Pick<SettlementPlan, 'anchor' | 'kind'>): number {
  if (plan.anchor === 'city') return 0
  if (plan.anchor === 'village') return 1
  return plan.kind === 'city' ? 2 : 3
}

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

function segmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / Math.max(1, dx * dx + dz * dz)))
  return Math.hypot(px - ax - dx * t, pz - az - dz * t)
}

/** Exact route proximity prevents a curved connector disappearing near its bend. */
function roadDistance(px: number, pz: number, road: SettlementRoad): number {
  let nearest = Infinity
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!, b = road.points[i]!
    nearest = Math.min(nearest, segmentDistance(px, pz, a.x, a.z, b.x, b.z))
  }
  return nearest
}

function createRoadGeometry(roads: SettlementRoad[], originX: number, originY: number, originZ: number): BufferGeometry | null {
  const positions: number[] = []
  for (const road of roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!, b = road.points[i]!
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    if (!length) continue
    const nx = -(b.z - a.z) / length * road.width / 2
    const nz = (b.x - a.x) / length * road.width / 2
    const vertices = [
      { x: a.leftX ?? a.x + nx, z: a.leftZ ?? a.z + nz, y: a.leftY ?? a.y },
      { x: a.rightX ?? a.x - nx, z: a.rightZ ?? a.z - nz, y: a.rightY ?? a.y },
      { x: b.leftX ?? b.x + nx, z: b.leftZ ?? b.z + nz, y: b.leftY ?? b.y },
      { x: b.rightX ?? b.x - nx, z: b.rightZ ?? b.z - nz, y: b.rightY ?? b.y },
    ]
    for (const index of [0, 2, 1, 1, 2, 3]) {
      const v = vertices[index]!
      positions.push(v.x - originX, v.y - originY, v.z - originZ)
    }
  }
  if (!positions.length) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Keep wet route spans together so a connector can change deck material once. */
function bridgeSpans(road: SettlementRoad): SettlementRoad[] {
  const spans: SettlementRoad[] = []
  let points: SettlementRoad['points'] = []
  for (let i = 0; i < road.points.length; i++) {
    const point = road.points[i]!
    if (point.bridge) {
      if (!points.length && i > 0) points.push(road.points[i - 1]!)
      points.push(point)
    } else if (points.length) {
      points.push(point)
      if (points.length > 1) spans.push({ width: road.width, points })
      points = []
    }
  }
  if (points.length > 1) spans.push({ width: road.width, points })
  return spans
}

interface LoadedSettlement { plan: SettlementPlan; root: Group; detail: Group }
interface LoadedRoad { root: Group; from: SettlementPlan; to: SettlementPlan; road: SettlementRoad }
interface RoadJob { key: string; from: SettlementPlan; to: SettlementPlan }
interface ReadyRoad extends RoadJob { road: SettlementRoad }

/** Independent scenery stream: shared geometry, instanced buildings, no shadow passes. */
export class SettlementSystem {
  readonly root = new Group()
  private readonly box = new BoxGeometry(1, 1, 1)
  private readonly tower = new CylinderGeometry(.5, .5, 1, 8)
  private readonly roof = roofGeometry()
  private readonly walls = new MeshStandardMaterial({ roughness: .82, metalness: .06 })
  private readonly roofs = new MeshStandardMaterial({ roughness: .95 })
  private readonly asphalt = new MeshStandardMaterial({ color: 0x4b4c48, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  private readonly gravelShoulder = new MeshStandardMaterial({ color: 0x887d66, emissive: 0x17140f, emissiveIntensity: .12,
    roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  private readonly streetMark = new MeshStandardMaterial({ color: 0xd2bd6b, emissive: 0x453b16, emissiveIntensity: .12,
    roughness: .82, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  // Regional links need a readable silhouette through the flight fog. A
  // restrained cool emissive lift keeps asphalt visible at distance without
  // making close roads glow or adding another material pass.
  private readonly highway = new MeshStandardMaterial({ color: 0x72746f, emissive: 0x15191a, emissiveIntensity: .2,
    roughness: .92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  private readonly bridgeDeck = new MeshStandardMaterial({ color: 0x777a76, roughness: .9, metalness: .02,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  private readonly highwayMark = new MeshStandardMaterial({ color: 0xe0c974, emissive: 0x735a1c, emissiveIntensity: .28,
    roughness: .8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
  private readonly highwayEdge = new MeshStandardMaterial({ color: 0xd9cf9f, emissive: 0x65582c, emissiveIntensity: .2,
    roughness: .86, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
  private readonly roadRain = { value: 0 }
  private readonly roadSnow = { value: 0 }
  private readonly buildingRain = { value: 0 }
  private readonly buildingSnow = { value: 0 }
  private readonly buildingDaylight = { value: 1 }
  private readonly loaded = new Map<string, LoadedSettlement>()
  private readonly connections = new Map<string, LoadedRoad>()
  private readonly checked = new Set<string>()
  private readonly checkedLinks = new Set<string>()
  /** One canonical job per graph edge, retained while one nearby cell owns it. */
  private readonly roadJobs = new Map<string, RoadJob>()
  private readonly roadSources = new Map<string, Set<string>>()
  private queue: { cx: number; cz: number; key: string }[] = []
  private linkQueue: RoadJob[] = []
  private lastCell = ''
  private worker: Worker | null = null
  private inFlight: SettlementWorkerRequest | null = null
  private ready: { key: string; plan: SettlementPlan }[] = []
  private readyRoads: ReadyRoad[] = []
  private generation = 0

  constructor(scene: Scene) {
    this.root.name = 'Settlements'
    scene.add(this.root)
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./settlement.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (event: MessageEvent<SettlementWorkerReply>) => {
        this.inFlight = null
        const result = event.data
        if (result.generation !== this.generation) return
        if (result.type === 'settlement') {
          if (this.checked.has(result.key) && result.plan) {
            this.scheduleLinks(result.plan, result.key)
            this.ready.push({ key: result.key, plan: result.plan })
          }
        } else if (this.checkedLinks.has(result.key) && result.road) {
          const job = this.roadJobs.get(result.key)
          if (job) this.readyRoads.push({ ...job, road: result.road })
        }
      }
      this.worker.onerror = () => {
        this.worker?.terminate(); this.worker = null
        if (this.inFlight?.generation === this.generation) {
          if (this.inFlight.type === 'settlement') {
            this.checked.delete(this.inFlight.key)
            this.queue.unshift(this.inFlight)
          } else {
            // Keep the canonical edge marked while the synchronous fallback
            // consumes it. Otherwise a second endpoint can enqueue a duplicate.
            if (this.roadSources.has(this.inFlight.key)) this.linkQueue.unshift(this.inFlight)
          }
        }
        this.inFlight = null
      }
    }
    for (const material of [this.asphalt, this.gravelShoulder, this.highway, this.bridgeDeck, this.highwayEdge]) {
      this.configureWeatherRoadMaterial(material)
    }
    this.configureWeatherRoofMaterial()
    // Facade windows live in the body shader, not thousands of separate meshes.
    this.walls.onBeforeCompile = shader => {
      shader.uniforms.settlementRain = this.buildingRain
      shader.uniforms.settlementSnow = this.buildingSnow
      shader.uniforms.settlementDaylight = this.buildingDaylight
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        varying vec2 settlementUv;
        varying float settlementWall;
        varying float settlementSeed;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        settlementWall = 1.0 - abs(normal.y);
        settlementSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(.013, .017))) * 43758.5453);
        settlementUv = uv * vec2(abs(normal.x) > .5 ? length(instanceMatrix[2].xyz) : length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec2 settlementUv;
        varying float settlementWall;
        varying float settlementSeed;
        uniform float settlementRain;
        uniform float settlementSnow;
        uniform float settlementDaylight;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        // Deterministic per-building facade rhythm keeps the skyline from
        // reading as one repeated apartment texture while remaining one draw.
        float columns = mix(8.0, 15.0, settlementSeed);
        float rows = mix(7.0, 14.0, fract(settlementSeed * 7.31));
        vec2 grid = settlementUv / vec2(columns, rows);
        vec2 pane = fract(grid + vec2(fract(settlementSeed * 5.1), fract(settlementSeed * 9.7)) * .35);
        vec2 aa = max(fwidth(grid), vec2(.001));
        vec2 windowShape = smoothstep(vec2(.22, .3) - aa, vec2(.22, .3) + aa, pane)
          * (1.0 - smoothstep(vec2(.72, .75) - aa, vec2(.72, .75) + aa, pane));
        float windowMask = settlementWall * windowShape.x * windowShape.y
          * (1.0 - smoothstep(.2, .55, max(aa.x, aa.y)));
        vec3 warmWindows = vec3(1.15, .5, .18);
        vec3 coolWindows = vec3(.075, .12, .15);
        vec3 windowColor = mix(warmWindows, coolWindows, settlementDaylight);
        windowColor = mix(windowColor, vec3(.32, .58, .78), smoothstep(.72, .96, fract(settlementSeed * 13.7)) * .42);
        float lightVariation = mix(.58, 1.0, smoothstep(.18, .82, fract(settlementSeed * 19.1 + grid.x * .13)));
        float windowStrength = windowMask * lightVariation * (.78 + (1.0 - settlementDaylight) * .18);
        diffuseColor.rgb = mix(diffuseColor.rgb, windowColor, windowStrength);
        diffuseColor.rgb *= 1.0 - settlementRain * .08;
        float wallSnowMask = (1.0 - settlementWall) * settlementSnow * .2;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.68, .74, .8), wallSnowMask);`)
    }
    this.walls.customProgramCacheKey = () => 'settlement-facades-weather-v3'
  }

  setWeatherEffects(rain: number, snow: number, daylight = this.buildingDaylight.value): void {
    this.roadRain.value = MathUtils.clamp(rain, 0, 1)
    this.roadSnow.value = MathUtils.clamp(snow, 0, 1)
    this.buildingRain.value = this.roadRain.value
    this.buildingSnow.value = this.roadSnow.value
    this.buildingDaylight.value = MathUtils.clamp(daylight, 0, 1)
  }

  get weatherEffects(): { rain: number; snow: number } {
    return { rain: this.roadRain.value, snow: this.roadSnow.value }
  }

  get lightingEffects(): { daylight: number } {
    return { daylight: this.buildingDaylight.value }
  }

  private configureWeatherRoadMaterial(material: MeshStandardMaterial): void {
    material.onBeforeCompile = shader => {
      shader.uniforms.settlementRain = this.roadRain
      shader.uniforms.settlementSnow = this.roadSnow
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform float settlementRain;\nuniform float settlementSnow;\n',
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= 1.0 - settlementRain * 0.2;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.72, 0.74), settlementSnow * 0.22);`,
      )
    }
    material.customProgramCacheKey = () => 'settlement-road-weather-v1'
  }

  private configureWeatherRoofMaterial(): void {
    this.roofs.onBeforeCompile = shader => {
      shader.uniforms.settlementRain = this.buildingRain
      shader.uniforms.settlementSnow = this.buildingSnow
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        varying float settlementRoofTop;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        settlementRoofTop = objectNormal.y;`)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying float settlementRoofTop;\nuniform float settlementRain;\nuniform float settlementSnow;\n',
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float roofSnowMask = smoothstep(.34, .92, settlementRoofTop) * settlementSnow * .7;
        diffuseColor.rgb *= 1.0 - settlementRain * .12;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.72, .78, .84), roofSnowMask);`,
      )
    }
    this.roofs.customProgramCacheKey = () => 'settlement-roofs-weather-v1'
  }

  get count(): number { return this.loaded.size }
  get buildingCount(): number {
    let count = 0
    for (const settlement of this.loaded.values()) count += settlement.plan.buildings.length
    return count
  }
  get pendingCount(): number {
    return this.queue.length + this.ready.length + this.linkQueue.length + this.readyRoads.length + (this.inFlight ? 1 : 0)
  }
  get roadCount(): number { return this.connections.size }

  clearAll(): void {
    for (const settlement of this.loaded.values()) this.remove(settlement)
    for (const connection of this.connections.values()) this.removeRoad(connection)
    this.loaded.clear()
    this.connections.clear()
    this.checked.clear()
    this.checkedLinks.clear()
    this.roadJobs.clear()
    this.roadSources.clear()
    this.queue = []
    this.linkQueue = []
    this.ready = []
    this.readyRoads = []
    this.generation++
    this.lastCell = ''
  }

  dispose(): void {
    this.clearAll()
    this.worker?.terminate(); this.worker = null
    this.root.removeFromParent()
    this.box.dispose(); this.tower.dispose(); this.roof.dispose()
    this.walls.dispose(); this.roofs.dispose(); this.asphalt.dispose(); this.gravelShoulder.dispose(); this.highway.dispose(); this.bridgeDeck.dispose(); this.highwayMark.dispose(); this.highwayEdge.dispose()
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
        if (settlement) {
          this.remove(settlement); this.loaded.delete(key)
        }
        this.releaseLinksForCell(key)
        this.checked.delete(key)
      }
      // Keep queued cells that are still inside the new envelope. Replacing
      // the queue on every kilometre discarded work faster than the worker
      // could finish it at top speed, making valid settlements appear absent.
      const retained = this.queue.filter(job => wanted.has(job.key) && !this.checked.has(job.key))
      const retainedKeys = new Set(retained.map(job => job.key))
      for (const job of pending) {
        if (!retainedKeys.has(job.key)) retained.push(job)
      }
      this.queue = retained.sort((a, b) => {
        const pad = getOpsPad()
        const anchorRank = (job: { cx: number; cz: number }): number => {
          // Some unit tests replace SettlementPlan with a minimal mock. The
          // optional call keeps that harness compatible while production
          // builds still put guaranteed landmarks at the front of the queue.
          let anchor: 'city' | 'village' | null = null
          try {
            anchor = settlementPlanApi.settlementAnchorForCell?.(job.cx, job.cz, pad) ?? null
          } catch {
            // A partial module mock may throw when an optional export is read.
          }
          return anchor === 'city' ? 0 : anchor === 'village' ? 1 : 2
        }
        const rank = anchorRank(a) - anchorRank(b)
        if (rank) return rank
        const ax = (a.cx + .5) * SETTLEMENT_CELL_SIZE - x
        const az = (a.cz + .5) * SETTLEMENT_CELL_SIZE - z
        const bx = (b.cx + .5) * SETTLEMENT_CELL_SIZE - x
        const bz = (b.cz + .5) * SETTLEMENT_CELL_SIZE - z
        return Math.hypot(ax, az) - Math.hypot(bx, bz)
      })
    }
    this.pruneDistantRoads(x, z)
    // Worker completion order is nondeterministic. Always consume the nearest
    // ready plan first so a distant village cannot occupy the fixed instance
    // budget before a nearby city or village finishes planning.
    this.ready.sort((a, b) => {
      const priority = settlementLoadPriority(a.plan) - settlementLoadPriority(b.plan)
      if (priority) return priority
      const ad = Math.hypot(a.plan.x - x, a.plan.z - z)
      const bd = Math.hypot(b.plan.x - x, b.plan.z - z)
      return ad - bd
    })
    const ready = this.ready.shift()
    if (ready && this.checked.has(ready.key)) {
      if (this.canLoad(ready.plan, x, z)) this.loaded.set(ready.key, this.build(ready.plan))
      else this.ready.push(ready)
    }
    const readyRoadIndex = this.nearestReadyRoad(x, z)
    if (readyRoadIndex >= 0) {
      const readyRoad = this.readyRoads[readyRoadIndex]!
      if (this.canLoadRoad(readyRoad, x, z)) {
        this.readyRoads.splice(readyRoadIndex, 1)
        if (!this.connections.has(readyRoad.key)) {
          this.connections.set(readyRoad.key, this.buildRegionalRoad(readyRoad.road, readyRoad.from, readyRoad.to))
        }
      }
    }
    // Terrain suitability runs off the render thread. One in-flight request
    // bounds worker traffic; stale replies after reseeds are discarded.
    const job = this.inFlight ? undefined : this.queue.shift()
    if (job) {
      this.checked.add(job.key)
      if (this.worker) {
        this.inFlight = { type: 'settlement', ...job, generation: this.generation, seed: getWorldSeed(), pad: getOpsPad() }
        this.worker.postMessage(this.inFlight)
      } else {
        const plan = settlementForCell(job.cx, job.cz)
        if (plan) {
          this.scheduleLinks(plan, job.key)
          if (this.canLoad(plan, x, z)) this.loaded.set(job.key, this.build(plan))
        }
      }
    } else if (!this.inFlight) {
      this.prioritizeRoadQueue(x, z)
      const link = this.linkQueue.shift()
      if (link && this.worker) {
        this.inFlight = { type: 'road', ...link, generation: this.generation, seed: getWorldSeed(), pad: getOpsPad() }
        this.worker.postMessage(this.inFlight)
      } else if (link) {
        const road = roadBetweenSettlements(link.from, link.to)
        if (road && this.checkedLinks.has(link.key)) this.readyRoads.push({ ...link, road })
      }
    }
    for (const { plan, root, detail } of this.loaded.values()) {
      const distance = Math.hypot(plan.x - x, plan.z - z)
      root.visible = distance < LOAD_RADIUS + plan.radius
      detail.visible = distance < DETAIL_RADIUS + plan.radius
    }
    for (const connection of this.connections.values()) {
      connection.root.visible = roadDistance(x, z, connection.road) < ROAD_LOAD_RADIUS
    }
  }

  hitObstacle(x: number, y: number, z: number): boolean {
    for (const { plan } of this.loaded.values()) if (hitsSettlement(plan, x, y, z)) return true
    return false
  }

  private canLoad(plan: SettlementPlan, x: number, z: number): boolean {
    if (this.loaded.has(plan.id)) return false
    if (plan.buildings.length > MAX_LOADED_BUILDINGS) return false

    // Keep the fixed GPU budget, but let an anchor landmark evict a random
    // settlement when either cap is reached. The old nearest-only policy let
    // four ordinary villages crowd out the guaranteed city and village, so
    // the landmarks existed in the worker but never appeared in the scene.
    const candidateDistance = Math.hypot(plan.x - x, plan.z - z)
    while (this.loaded.size >= MAX_LOADED_SETTLEMENTS ||
      this.buildingCount + plan.buildings.length > MAX_LOADED_BUILDINGS) {
      let farthestKey = ''
      let farthestDistance = -Infinity
      let farthestPriority = -Infinity
      for (const [key, loaded] of this.loaded) {
        // Anchor landmarks are mutually protected. Only ordinary settlements
        // can be displaced to make room for a missing guaranteed tier.
        if (loaded.plan.anchor) continue
        const distance = Math.hypot(loaded.plan.x - x, loaded.plan.z - z)
        const priority = settlementLoadPriority(loaded.plan)
        if (priority > farthestPriority || (priority === farthestPriority && distance > farthestDistance)) {
          farthestPriority = priority
          farthestDistance = distance
          farthestKey = key
        }
      }
      if (!farthestKey) return false
      // Anchors are allowed to displace a random plan from anywhere in the
      // envelope. Ordinary plans still need to be nearer than the eviction
      // candidate, preserving the normal streaming budget behavior.
      if (!plan.anchor && candidateDistance >= farthestDistance) return false
      const farthest = this.loaded.get(farthestKey)
      if (!farthest) return false
      this.remove(farthest)
      this.loaded.delete(farthestKey)
    }
    return true
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
    const flatHangars = plan.buildings.filter(b => b.shape === 'hangar' && b.roof === 'flat')
    const gables = new InstancedMesh(this.roof, this.roofs, pitched.length)
    const crowns = flat.filter(b => plan.kind === 'city' && b.height > 250)
    const caps = new InstancedMesh(this.box, this.roofs, flat.length + crowns.length)
    const hangarCaps = new InstancedMesh(this.roof, this.roofs, flatHangars.length)
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
    // Flat-roof hangars still get a broad shared canopy so their silhouette
    // reads as a civic or industrial hall instead of another plain box.
    flatHangars.forEach((b, i) => put(hangarCaps, i, b.x, b.y + b.height + .55, b.z,
      b.width * 1.12, Math.min(b.width, b.depth) * .22, b.depth * 1.08, b.yaw, b.roofColor))
    for (const mesh of [body, towerBodies, stepBodies, gables, caps, hangarCaps]) {
      if (!mesh.count) { mesh.dispose(); continue }
      mesh.computeBoundingSphere()
      // Roof silhouettes stay visible at distance too; only ground detail is culled.
      root.add(mesh)
    }
    const localShoulders: SettlementRoad[] = plan.roads.map(road => ({
      width: road.width * 1.35,
      points: road.points.map(point => ({ ...point, y: point.y - .08 })),
    }))
    const shoulderGeometry = createRoadGeometry(localShoulders, plan.x, plan.y, plan.z)
    if (shoulderGeometry) {
      const mesh = new Mesh(shoulderGeometry, this.gravelShoulder)
      mesh.name = 'SettlementRoadShoulders'
      detail.add(mesh)
    }
    const geometry = createRoadGeometry(plan.roads, plan.x, plan.y, plan.z)
    if (geometry) {
      const mesh = new Mesh(geometry, this.asphalt)
      mesh.name = 'SettlementRoads'
      detail.add(mesh)
    }
    // One batched centerline mesh keeps local streets readable from the chase
    // camera without creating a draw call per street segment.
    const centerlines: SettlementRoad[] = plan.roads.map(road => ({
      width: Math.min(1.35, road.width * .045),
      points: road.points.map(point => ({ ...point, y: point.y + .16 })),
    }))
    const markingGeometry = createRoadGeometry(centerlines, plan.x, plan.y, plan.z)
    if (markingGeometry) {
      const mesh = new Mesh(markingGeometry, this.streetMark)
      mesh.name = 'SettlementRoadMarkings'
      detail.add(mesh)
    }
    this.root.add(root)
    return { root, detail, plan }
  }

  /**
   * A route belongs to nearby source cells, not to the building roots that
   * happened to survive the four-settlement instance budget. Both endpoints
   * can discover the same canonical edge without creating another job.
   */
  private scheduleLinks(plan: SettlementPlan, sourceKey: string): void {
    for (const link of regionalLinksForSettlement(plan)) {
      const sources = this.roadSources.get(link.key) ?? new Set<string>()
      sources.add(sourceKey)
      this.roadSources.set(link.key, sources)
      if (this.checkedLinks.has(link.key)) continue
      const job: RoadJob = { key: link.key, from: link.from, to: link.to }
      this.checkedLinks.add(link.key)
      this.roadJobs.set(link.key, job)
      this.linkQueue.push(job)
    }
  }

  /** Drop an edge only after every nearby source cell that discovered it leaves. */
  private releaseLinksForCell(sourceKey: string): void {
    for (const [key, sources] of this.roadSources) {
      if (!sources.delete(sourceKey) || sources.size) continue
      this.roadSources.delete(key)
      this.checkedLinks.delete(key)
      this.roadJobs.delete(key)
      this.linkQueue = this.linkQueue.filter(job => job.key !== key)
      this.readyRoads = this.readyRoads.filter(road => road.key !== key)
      const connection = this.connections.get(key)
      if (connection) {
        this.removeRoad(connection)
        this.connections.delete(key)
      }
    }
  }

  /** Keep cached road plans but release GPU meshes as the player flies away. */
  private pruneDistantRoads(x: number, z: number): void {
    for (const [key, connection] of this.connections) {
      if (roadDistance(x, z, connection.road) <= ROAD_KEEP_RADIUS) continue
      this.connections.delete(key)
      this.removeRoad(connection)
      this.deferRoad({ key, from: connection.from, to: connection.to, road: connection.road })
    }
  }

  private deferRoad(road: ReadyRoad): void {
    if (!this.checkedLinks.has(road.key) || !this.roadSources.has(road.key) || this.connections.has(road.key)) return
    if (!this.readyRoads.some(candidate => candidate.key === road.key)) this.readyRoads.push(road)
  }

  /** Choose the closest visible-ready route rather than whichever worker reply arrived first. */
  private nearestReadyRoad(x: number, z: number): number {
    this.readyRoads = this.readyRoads.filter(road => this.checkedLinks.has(road.key) && !this.connections.has(road.key))
    let nearest = -1, nearestDistance = Infinity
    for (let i = 0; i < this.readyRoads.length; i++) {
      const distance = roadDistance(x, z, this.readyRoads[i]!.road)
      if (distance > ROAD_LOAD_RADIUS || distance >= nearestDistance) continue
      nearest = i
      nearestDistance = distance
    }
    return nearest
  }

  /** Generate the connector nearest to the aircraft before distant links. */
  private prioritizeRoadQueue(x: number, z: number): void {
    this.linkQueue.sort((a, b) => {
      const distance = (job: RoadJob): number => Math.min(
        Math.hypot(job.from.x - x, job.from.z - z),
        Math.hypot(job.to.x - x, job.to.z - z),
      )
      return distance(a) - distance(b) || a.key.localeCompare(b.key)
    })
  }

  /** A fixed mesh budget prevents a dense road graph from growing frame cost. */
  private canLoadRoad(candidate: ReadyRoad, x: number, z: number): boolean {
    if (this.connections.size < MAX_LOADED_REGIONAL_ROADS) return true
    const candidateDistance = roadDistance(x, z, candidate.road)
    let farthestKey = '', farthest: LoadedRoad | undefined, farthestDistance = -Infinity
    for (const [key, connection] of this.connections) {
      const distance = roadDistance(x, z, connection.road)
      if (distance > farthestDistance) { farthestKey = key; farthest = connection; farthestDistance = distance }
    }
    if (!farthest || candidateDistance >= farthestDistance) return false
    this.connections.delete(farthestKey)
    this.removeRoad(farthest)
    this.deferRoad({ key: farthestKey, from: farthest.from, to: farthest.to, road: farthest.road })
    return true
  }

  private buildRegionalRoad(road: SettlementRoad, from: SettlementPlan, to: SettlementPlan): LoadedRoad {
    const root = new Group()
    root.name = `regional_road_${regionalRoadKey(from, to)}`
    const x = (from.x + to.x) / 2, z = (from.z + to.z) / 2
    root.position.set(x, 0, z)
    // A broad gravel shoulder keeps the connector legible through the flight
    // fog and separates it from pale grass or sand without another road pass.
    const shoulderRoad: SettlementRoad = {
      width: road.width * 1.55,
      points: road.points.map(point => ({ x: point.x, y: point.y - .08, z: point.z })),
    }
    const shoulderGeometry = createRoadGeometry([shoulderRoad], x, 0, z)
    if (shoulderGeometry) {
      const shoulder = new Mesh(shoulderGeometry, this.gravelShoulder)
      shoulder.name = 'RegionalRoadShoulder'
      root.add(shoulder)
    }
    const geometry = createRoadGeometry([road], x, 0, z)
    if (geometry) root.add(new Mesh(geometry, this.highway))
    const bridgeGeometry = createRoadGeometry(bridgeSpans(road), x, 0, z)
    if (bridgeGeometry) {
      const bridge = new Mesh(bridgeGeometry, this.bridgeDeck)
      bridge.name = 'RegionalBridgeDeck'
      root.add(bridge)
    }
    const centerline: SettlementRoad = { width: 2.8, points: road.points.map(point => ({ x: point.x, y: point.y + .18, z: point.z })) }
    const marking = createRoadGeometry([centerline], x, 0, z)
    if (marking) root.add(new Mesh(marking, this.highwayMark))
    // Edge strips give long links a readable silhouette through haze while
    // staying as one batched mesh per connector.
    const edges: SettlementRoad[] = [
      { width: 2.4, points: road.points.map(point => ({ x: point.leftX ?? point.x, y: (point.leftY ?? point.y) + .2, z: point.leftZ ?? point.z })) },
      { width: 2.4, points: road.points.map(point => ({ x: point.rightX ?? point.x, y: (point.rightY ?? point.y) + .2, z: point.rightZ ?? point.z })) },
    ]
    const edgeGeometry = createRoadGeometry(edges, x, 0, z)
    if (edgeGeometry) root.add(new Mesh(edgeGeometry, this.highwayEdge))
    this.root.add(root)
    return { root, from, to, road }
  }

  private removeRoad(road: LoadedRoad): void {
    road.root.removeFromParent()
    road.root.traverse(object => { if (object instanceof Mesh) object.geometry.dispose() })
  }

  private remove(settlement: LoadedSettlement): void {
    settlement.root.removeFromParent()
    settlement.root.traverse(object => {
      if (object instanceof InstancedMesh) object.dispose()
      else if (object instanceof Mesh) object.geometry.dispose()
    })
  }
}
