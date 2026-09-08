import type { MeshStandardMaterial } from 'three'
import { waterNormals } from './WaterNormals'

/** Calm reflective water; tiny optical ripples never move the actual water level. */
export function applyWaterAppearance(material: MeshStandardMaterial, clock: { value: number }): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.worldWaterTime = clock
    shader.uniforms.waterNormals = { value: waterNormals }
    shader.vertexShader = 'attribute float waterDepth;\nvarying float vWaterDepth;\nvarying vec3 vWaterWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvWaterDepth = waterDepth;\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = 'uniform float worldWaterTime;\nuniform sampler2D waterNormals;\nvarying float vWaterDepth;\nvarying vec3 vWaterWorld;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float depthMix = 1.0 - exp(-vWaterDepth * 0.055);
      diffuseColor.rgb = mix(vec3(0.075, 0.34, 0.38), vec3(0.012, 0.065, 0.14), depthMix);
      // A restrained foam-tinted shoreline, without repeated contour stripes.
      float wetEdge = exp(-max(0.0, vWaterDepth) * 2.5);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.46, 0.67, 0.58), wetEdge * 0.16);
      // Drift a low-contrast foam breakup through the first metre of water so
      // coves and river mouths do not read as a perfectly uniform ring.
      float foamNoise = texture2D(waterNormals, vWaterWorld.xz / 96.0 + vec2(worldWaterTime * 0.006, -worldWaterTime * 0.004)).r;
      float foamBand = smoothstep(0.54, 0.82, foamNoise) * (1.0 - smoothstep(0.12, 1.8, vWaterDepth));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.54, 0.74, 0.66), foamBand * 0.18);`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      float distanceFade = 1.0 - smoothstep(400.0, 3500.0, length(vWaterWorld - cameraPosition));
      vec2 p = vWaterWorld.xz;
      vec2 drift = vec2(worldWaterTime * 0.004, worldWaterTime * 0.002);
      vec2 rippleA = texture2D(waterNormals, p / 380.0 + drift).rg * 2.0 - 1.0;
      vec2 rippleB = texture2D(waterNormals, vec2(p.y, -p.x) / 113.0 - drift * 0.7).rg * 2.0 - 1.0;
      vec2 ripples = rippleA * 0.085 + rippleB * 0.035 * distanceFade;
      normal = normalize(normal + mat3(viewMatrix) * vec3(ripples.x, 0.0, ripples.y));
      float fresnel = 0.02 + 0.48 * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
      float glint = pow(max(0.0, rippleA.x + rippleB.y), 3.0) *
        (0.5 + 0.5 * sin(worldWaterTime * 0.7 + p.x * 0.002));
      vec3 reflectedSky = vec3(0.18, 0.46, 0.58) + vec3(0.12, 0.16, 0.14) * glint;
      #ifdef USE_FOG
        reflectedSky = fogColor * 0.85;
      #endif
      totalEmissiveRadiance += reflectedSky * fresnel;`,
    )
  }
  material.customProgramCacheKey = () => 'calm-basin-water-v4'
}
