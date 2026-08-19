import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Scene,
} from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'
import {
  OPS_PAD_INNER,
  OPS_PAD_OUTER,
  getOpsPad,
  opsPadBlend,
  sampleClimate,
} from '../world/terrainSample'
import type { SpawnPose } from '../world/World'

/**
 * Hidden map-gen inspector. Only constructed when isDebugEnabled().
 */
export class DebugOverlay {
  private readonly el: HTMLPreElement
  private readonly marks: Group
  private readonly inner: Mesh
  private readonly outer: Mesh

  constructor(scene: Scene) {
    this.el = document.createElement('pre')
    this.el.id = 'blackout-debug'
    this.el.style.cssText = [
      'position:fixed',
      'left:8px',
      'bottom:8px',
      'z-index:9999',
      'margin:0',
      'padding:8px 10px',
      'max-width:min(420px,46vw)',
      'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:#c8f0e0',
      'background:rgba(4,8,12,0.78)',
      'border:1px solid rgba(61,206,168,0.35)',
      'border-radius:6px',
      'pointer-events:none',
      'white-space:pre',
      'text-shadow:0 1px 2px #000',
    ].join(';')
    document.body.appendChild(this.el)

    this.marks = new Group()
    this.marks.name = 'DebugPadMarks'
    const innerMat = new MeshBasicMaterial({
      color: 0x3dcea8,
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
      depthWrite: false,
    })
    const outerMat = new MeshBasicMaterial({
      color: 0xf0b429,
      transparent: true,
      opacity: 0.4,
      side: DoubleSide,
      depthWrite: false,
    })
    this.inner = new Mesh(new RingGeometry(OPS_PAD_INNER - 1.2, OPS_PAD_INNER + 1.2, 64), innerMat)
    this.outer = new Mesh(new RingGeometry(OPS_PAD_OUTER - 1.6, OPS_PAD_OUTER + 1.6, 64), outerMat)
    this.inner.rotation.x = -Math.PI / 2
    this.outer.rotation.x = -Math.PI / 2
    this.marks.add(this.inner, this.outer)
    scene.add(this.marks)
  }

  syncPad(): void {
    const pad = getOpsPad()
    if (!pad) {
      this.marks.visible = false
      return
    }
    this.marks.visible = true
    this.marks.position.set(pad.x, pad.y + 0.4, pad.z)
  }

  update(aircraft: Aircraft, spawn: SpawnPose, cam: string, fps: number): void {
    this.syncPad()
    const { x, y, z } = aircraft.position
    const c = sampleClimate(x, z)
    const pad = getOpsPad()
    const kts = aircraft.speed * 1.94384
    const targetKts = aircraft.controls.boost
      ? flightConfig.maxSpeedBoost * 1.94384
      : aircraft.controls.throttle * flightConfig.maxSpeed * 1.94384
    const blend = opsPadBlend(x, z)
    const padDist = pad ? Math.hypot(x - pad.x, z - pad.z) : -1

    this.el.textContent = [
      'DEBUG  ?debug=1',
      `pos   ${x.toFixed(0)}  ${y.toFixed(1)}  ${z.toFixed(0)}`,
      `h/land ${c.height.toFixed(1)} m   land ${c.land.toFixed(2)}   coast ${c.coastal.toFixed(2)}`,
      `biome ${c.biome}${c.biomeMix > 0.05 ? ` / ${c.biomeB} ${c.biomeMix.toFixed(2)}` : ''}`,
      `water r${c.features.river.toFixed(2)} lk${c.features.lake.toFixed(2)} rv${c.features.ravine.toFixed(2)}`,
      `pad   ${pad ? `${pad.x.toFixed(0)},${pad.z.toFixed(0)} y=${pad.y.toFixed(1)}` : 'off'}  d=${padDist.toFixed(0)}  blend=${blend.toFixed(2)}`,
      `spawn ${spawn.biome}  yaw=${((spawn.yaw * 180) / Math.PI).toFixed(0)}  y=${spawn.y.toFixed(1)}`,
      `ias   ${kts.toFixed(0)} kts  tgt ${targetKts.toFixed(0)}  eng ${(aircraft.controls.throttle * 100).toFixed(1)}%${aircraft.controls.boost ? ' BOOST' : ''}`,
      `gnd   ${aircraft.onGround ? 'yes' : 'no'}  impactVy ${aircraft.impactVy.toFixed(1)}  cam ${cam}  ${fps.toFixed(0)} fps`,
    ].join('\n')
  }
}
