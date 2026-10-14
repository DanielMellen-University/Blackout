import { DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshBasicMaterial, Object3D, PlaneGeometry, Vector3 } from 'three'

const CAPACITY = 16
const BANKS = 46
const STRIDE = 6
const hidden = new Matrix4().makeScale(0, 0, 0)

/** A single depth-tested draw under visible wet cloud banks. Ground and water
 * depth naturally occlude its lower part, without any terrain queries. */
export class RainShafts {
  readonly mesh: InstancedMesh
  private readonly candidates = new Float64Array(BANKS * STRIDE)
  private readonly scores = new Float64Array(BANKS).fill(-1)
  private readonly slots = new Int16Array(CAPACITY).fill(-1)
  private readonly phases = new Float64Array(CAPACITY)
  private readonly opacity = new Float32Array(CAPACITY)
  private readonly occupied = new Uint8Array(BANKS)
  private readonly transform = new Object3D()
  private readonly material: MeshBasicMaterial
  private readonly alphas: InstancedBufferAttribute
  private readonly from: InstancedBufferAttribute
  private readonly phaseAttribute: InstancedBufferAttribute
  private density = 1
  private disposed = false

  constructor(drift = { value: new Vector3() }, blend = { value: 1 }, clock = { value: 0 }) {
    const geometry = new PlaneGeometry(1, 1)
    this.alphas = new InstancedBufferAttribute(new Float32Array(CAPACITY), 1).setUsage(DynamicDrawUsage)
    this.from = new InstancedBufferAttribute(new Float32Array(CAPACITY), 1).setUsage(DynamicDrawUsage)
    this.phaseAttribute = new InstancedBufferAttribute(new Float32Array(CAPACITY), 1).setUsage(DynamicDrawUsage)
    geometry.setAttribute('shaftAlpha', this.alphas)
    geometry.setAttribute('shaftAlphaFrom', this.from)
    geometry.setAttribute('shaftPhase', this.phaseAttribute)
    this.material = new MeshBasicMaterial({ color: 0x8198a7, transparent: true,
      opacity: .20, side: DoubleSide, depthTest: true, depthWrite: false, fog: true })
    this.material.onBeforeCompile = shader => {
      shader.uniforms.shaftDrift = drift; shader.uniforms.shaftBlend = blend; shader.uniforms.shaftClock = clock
      shader.vertexShader = `attribute float shaftAlpha;
        attribute float shaftAlphaFrom;
        attribute float shaftPhase;
        uniform vec3 shaftDrift;
        uniform float shaftBlend;
        varying vec2 vShaftUV;
        varying float vShaftAlpha;
        varying float vShaftPhase;\n` + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        mvPosition.xyz += (viewMatrix * vec4(shaftDrift, 0.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
        vShaftUV = uv;
        vShaftAlpha = mix(shaftAlphaFrom, shaftAlpha, clamp(shaftBlend, 0.0, 1.0));
        vShaftPhase = shaftPhase;`)
      shader.fragmentShader = `uniform float shaftClock;
        varying vec2 vShaftUV;
        varying float vShaftAlpha;
        varying float vShaftPhase;\n` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float side = smoothstep(0.0, .22, vShaftUV.x) * (1.0 - smoothstep(.78, 1.0, vShaftUV.x));
        float ends = smoothstep(0.0, .15, vShaftUV.y) * (1.0 - smoothstep(.94, 1.0, vShaftUV.y));
        float phase = vShaftPhase * 6.28318;
        float bands = .65 + .35 * sin(vShaftUV.x * 31.0 + phase + sin(vShaftUV.y * 5.0 + phase));
        float fall = .85 + .15 * sin(vShaftUV.y * 19.0 + shaftClock * .6 + phase);
        diffuseColor.a *= vShaftAlpha * side * ends * bands * fall;`)
    }
    this.material.customProgramCacheKey = () => 'rain-shafts-v1'
    this.mesh = new InstancedMesh(geometry, this.material, CAPACITY)
    this.mesh.name = 'RainShafts'; this.mesh.frustumCulled = false; this.mesh.visible = false
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    for (let i = 0; i < CAPACITY; i++) this.mesh.setMatrixAt(i, hidden)
  }

  setDensityScale(value: number): void {
    this.density = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
  }

  reset(): void {
    this.slots.fill(-1); this.opacity.fill(0); this.scores.fill(-1)
    this.alphas.array.fill(0); this.from.array.fill(0)
    this.alphas.needsUpdate = this.from.needsUpdate = true
    this.mesh.visible = false
  }

  begin(): void { this.scores.fill(-1) }

  offer(bank: number, x: number, top: number, z: number, width: number,
    intensity: number, phase: number, observerX: number, observerZ: number): void {
    if (this.disposed || bank < 0 || bank >= BANKS || !Number.isInteger(bank) ||
      !Number.isFinite(x + top + z + width + intensity + phase + observerX + observerZ)) return
    const distance = Math.hypot(x - observerX, z - observerZ)
    const near = Math.min(1, Math.max(0, (distance - 400) / 800))
    const far = Math.min(1, Math.max(0, (24000 - distance) / 6000))
    const alpha = Math.max(0, Math.min(1, intensity)) * near * far
    if (alpha < .01 || top < 100 || width <= 0) return
    const k = bank * STRIDE
    this.candidates[k] = x; this.candidates[k + 1] = top
    this.candidates[k + 2] = z; this.candidates[k + 3] = width
    this.candidates[k + 4] = alpha; this.candidates[k + 5] = phase
    this.scores[bank] = alpha / (1 + distance / 5000)
  }

  commit(dt: number, observerX: number, observerZ: number, daylight: number): void {
    if (this.disposed) return
    this.occupied.fill(0)
    const limit = Math.ceil(CAPACITY * this.density)
    for (let i = 0; i < CAPACITY; i++) {
      const bank = this.slots[i]!
      if ((i < limit || this.opacity[i]! >= .01) && bank >= 0 && this.scores[bank]! >= 0 &&
        this.candidates[bank * STRIDE + 5] === this.phases[i])
        this.occupied[bank] = 1
    }
    const fade = 1 - Math.exp(-Math.max(0, Number.isFinite(dt) ? dt : 0) * 1.5)
    let visible = false
    for (let i = 0; i < CAPACITY; i++) {
      let bank = this.slots[i]!
      let retained = i < limit && bank >= 0 && this.occupied[bank] === 1 &&
        this.candidates[bank * STRIDE + 5] === this.phases[i]
      if ((!retained || bank < 0) && this.opacity[i]! < .01 && i < limit) {
        let best = -1, score = 0
        for (let j = 0; j < BANKS; j++) if (!this.occupied[j] && this.scores[j]! > score) {
          best = j; score = this.scores[j]!
        }
        bank = best; this.slots[i] = best
        if (bank >= 0) { this.phases[i] = this.candidates[bank * STRIDE + 5]!; this.occupied[bank] = 1; retained = true }
      }
      const k = bank * STRIDE
      const target = retained ? this.candidates[k + 4]! : 0
      this.from.setX(i, this.opacity[i]!)
      this.opacity[i] = this.opacity[i]! + (target - this.opacity[i]!) * fade
      this.alphas.setX(i, this.opacity[i]!)
      if (bank < 0 || this.opacity[i]! < .001) { this.mesh.setMatrixAt(i, hidden); continue }
      visible = true
      if (retained) {
        const x = this.candidates[k]!, top = this.candidates[k + 1]!, z = this.candidates[k + 2]!
        this.transform.position.set(x, (top - 100) * .5, z)
        this.transform.rotation.set(0, Math.atan2((Number.isFinite(observerX) ? observerX : 0) - x,
          (Number.isFinite(observerZ) ? observerZ : 0) - z), 0)
        this.transform.scale.set(this.candidates[k + 3]!, top + 100, 1)
        this.transform.updateMatrix(); this.mesh.setMatrixAt(i, this.transform.matrix)
        this.phaseAttribute.setX(i, this.phases[i]!)
      }
    }
    const brightness = .55 + Math.max(0, Math.min(1, Number.isFinite(daylight) ? daylight : .5)) * .4
    this.material.color.setRGB(brightness * .72, brightness * .85, brightness)
    this.mesh.visible = visible
    this.mesh.instanceMatrix.needsUpdate = true
    this.alphas.needsUpdate = this.from.needsUpdate = this.phaseAttribute.needsUpdate = true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true; this.mesh.visible = false; this.mesh.removeFromParent()
    this.mesh.geometry.dispose(); this.material.dispose()
  }
}
