import type { MeshStandardMaterial } from 'three'

/** Animated optical waves; sea/lake levels and collision stay perfectly steady. */
export function applyWaterAppearance(material: MeshStandardMaterial, clock: { value: number }): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.worldWaterTime = clock
    shader.vertexShader = 'attribute float waterDepth;\nvarying float vWaterDepth;\nvarying vec3 vWaterWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvWaterDepth = waterDepth;\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = 'uniform float worldWaterTime;\nvarying float vWaterDepth;\nvarying vec3 vWaterWorld;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float depthMix = 1.0 - exp(-vWaterDepth * 0.045);
      vec3 shallow = vec3(0.07, 0.46, 0.43);
      vec3 deep = vec3(0.015, 0.065, 0.14);
      diffuseColor.rgb = mix(shallow, deep, depthMix);
      float shore = 1.0 - smoothstep(0.0, 5.0, vWaterDepth);
      float wash = 0.5 + 0.5 * sin(vWaterDepth * 2.6 - worldWaterTime * 1.8
        + sin(vWaterWorld.x * 0.025 + vWaterWorld.z * 0.04));
      float foam = shore * smoothstep(0.48, 0.92, wash) * 0.58;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.87, 0.86), foam);`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      float distanceFade = 1.0 - smoothstep(1500.0, 10000.0, length(vWaterWorld - cameraPosition));
      vec2 p = vWaterWorld.xz;
      float swellA = dot(p, vec2(0.032, 0.019)) + worldWaterTime * 0.65
        + sin(p.y * 0.006 + sin(p.x * 0.004)) * 2.0;
      float swellB = dot(p, vec2(-0.015, 0.048)) - worldWaterTime * 0.8
        + sin(p.x * 0.009) * 1.5;
      vec2 waves = (vec2(0.86, 0.51) * cos(swellA)
        + vec2(-0.30, 0.95) * sin(swellB)) * 0.035;
      waves += vec2(sin(p.y * 0.26 - worldWaterTime * 1.4),
        cos(p.x * 0.21 + worldWaterTime)) * 0.008 * distanceFade;
      normal = normalize(normal + mat3(viewMatrix) * vec3(waves.x, 0.0, waves.y));
      float fresnel = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
      // Analytic sky reflection avoids an extra scene render every frame.
      vec3 reflectedSky = vec3(0.16, 0.28, 0.38);
      #ifdef USE_FOG
        reflectedSky = mix(reflectedSky, fogColor, 0.65);
      #endif
      totalEmissiveRadiance += reflectedSky * fresnel * 0.24;`,
    )
  }
  material.customProgramCacheKey = () => 'independent-water-v2'
}
