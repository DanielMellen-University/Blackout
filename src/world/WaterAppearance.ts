import type { MeshStandardMaterial } from 'three'

/** Water stays physically level; only its lighting ripples move. */
export function applyWaterAppearance(material: MeshStandardMaterial, clock: { value: number }): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.worldWaterTime = clock
    shader.vertexShader = 'attribute vec2 waterData;\nvarying vec2 vWater;\nvarying vec2 vWaterXZ;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvWater = waterData;\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;',
    )
    shader.fragmentShader = 'uniform float worldWaterTime;\nvarying vec2 vWater;\nvarying vec2 vWaterXZ;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat wet = smoothstep(0.55, 0.98, vWater.x);\nfloat deepWater = smoothstep(1.0, 95.0, vWater.y);\nvec3 seaTint = mix(vec3(0.06, 0.32, 0.34), vec3(0.018, 0.07, 0.16), deepWater);\ndiffuseColor.rgb = mix(diffuseColor.rgb, seaTint, wet * 0.7);\nfloat shoreFoam = (1.0 - smoothstep(0.5, 4.0, vWater.y)) * wet;\nfloat wash = 0.5 + 0.5 * sin(vWaterXZ.x * 0.12 + vWaterXZ.y * 0.025 - worldWaterTime * 1.4);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.65, 0.77, 0.74), shoreFoam * wash * 0.16);',
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.24, wet);',
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\nvec3 rippleWorld = vec3(cos(vWaterXZ.x * 0.055 + vWaterXZ.y * 0.025 + worldWaterTime) * 0.025, 0.0, sin(vWaterXZ.y * 0.075 - worldWaterTime * 0.8) * 0.025);\nnormal = normalize(normal + mat3(viewMatrix) * rippleWorld * wet);',
    )
  }
  material.customProgramCacheKey = () => 'geographic-water-v1'
}
