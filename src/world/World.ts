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
    // Brighter fill so grey airframe reads as grey, not black metal
    const hemi = new HemisphereLight(0xd0e4f8, 0x4a5540, 0.85)
    this.scene.add(hemi)

    const ambient = new AmbientLight(0xffffff, 0.45)
    this.scene.add(ambient)

    const sun = new DirectionalLight(0xfff5e6, 1.65)
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

    // Soft fill from opposite side so the jet isn’t half-silhouette
    const fill = new DirectionalLight(0xb8d0ff, 0.45)
    fill.position.set(-80, 60, -40)
    this.scene.add(fill)
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
