import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
} from 'three'
import { createRunway } from './Runway'

/**
 * Scene graph for terrain, runway, sky, and lighting.
 */
export class World {
  readonly scene = new Scene()

  constructor() {
    this.scene.background = new Color(0x87a0b8)
    this.scene.fog = new Fog(0x87a0b8, 200, 1400)

    this.addLights()
    this.addTerrain()
    this.addRunway()
  }

  private addLights(): void {
    const hemi = new HemisphereLight(0xb8d0e8, 0x3a4035, 0.55)
    this.scene.add(hemi)

    const ambient = new AmbientLight(0xffffff, 0.25)
    this.scene.add(ambient)

    const sun = new DirectionalLight(0xfff2dd, 1.35)
    sun.position.set(120, 200, 80)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 10
    sun.shadow.camera.far = 500
    sun.shadow.camera.left = -150
    sun.shadow.camera.right = 150
    sun.shadow.camera.top = 150
    sun.shadow.camera.bottom = -150
    sun.shadow.bias = -0.0002
    this.scene.add(sun)
  }

  private addTerrain(): void {
    const size = 2000
    const geo = new PlaneGeometry(size, size, 1, 1)
    const mat = new MeshStandardMaterial({
      color: 0x3d5a3a,
      roughness: 0.95,
      metalness: 0.05,
    })

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3a5538'
    ctx.fillRect(0, 0, 512, 512)
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 512)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(512, i)
      ctx.stroke()
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${40 + Math.random() * 30},${70 + Math.random() * 40},${35 + Math.random() * 25},0.35)`
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 40 + Math.random() * 80, 40 + Math.random() * 80)
    }

    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(40, 40)
    mat.map = tex

    const ground = new Mesh(geo, mat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.name = 'Terrain'
    this.scene.add(ground)
  }

  private addRunway(): void {
    const runway = createRunway()
    runway.position.set(0, 0.02, 0)
    this.scene.add(runway)
  }
}
