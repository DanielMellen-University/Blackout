import type { MeshStandardMaterial } from 'three'
import { waterNormals } from './WaterNormals'

export interface WaterWeatherUniforms {
  rain: { value: number }
  snow: { value: number }
}

const DEFAULT_WEATHER: WaterWeatherUniforms = { rain: { value: 0 }, snow: { value: 0 } }

/** Calm reflective water; tiny optical ripples never move the actual water level. */
export function applyWaterAppearance(
  material: MeshStandardMaterial,
  clock: { value: number },
  weather: WaterWeatherUniforms = DEFAULT_WEATHER,
): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.worldWaterTime = clock
    shader.uniforms.waterRain = weather.rain
    shader.uniforms.waterSnow = weather.snow
    shader.uniforms.waterNormals = { value: waterNormals }
    shader.vertexShader = 'attribute float waterDepth;\nattribute float waterFlow;\nvarying float vWaterDepth;\nvarying float vWaterFlow;\nvarying vec3 vWaterWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvWaterDepth = waterDepth;\nvWaterFlow = waterFlow;\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = 'uniform float worldWaterTime;\nuniform float waterRain;\nuniform float waterSnow;\nuniform sampler2D waterNormals;\nvarying float vWaterDepth;\nvarying float vWaterFlow;\nvarying vec3 vWaterWorld;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float depthMix = 1.0 - exp(-vWaterDepth * 0.055);
      diffuseColor.rgb = mix(vec3(0.075, 0.34, 0.38), vec3(0.012, 0.065, 0.14), depthMix);
      float riverMix = smoothstep(0.2, 0.8, vWaterFlow);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.39, 0.42), riverMix * 0.32);
      // Two broad, moving bands break up the old single-color sheet without
      // turning the surface into noisy pixel glitter. The same field drives
      // every tile, so catchment borders keep a continuous water pattern.
      vec2 colorDrift = vec2(worldWaterTime * 0.0015, -worldWaterTime * 0.0011);
      float patchA = texture2D(waterNormals, vWaterWorld.xz / 230.0 + colorDrift).r;
      float patchB = texture2D(waterNormals, vec2(vWaterWorld.z, -vWaterWorld.x) / 510.0 - colorDrift * 0.6).g;
      float waterPattern = smoothstep(0.22, 0.78, patchA * 0.62 + patchB * 0.38);
      diffuseColor.rgb *= 0.86 + waterPattern * 0.24;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.82, 1.04, 1.1),
        (1.0 - riverMix) * (0.12 + waterPattern * 0.1));
      // A broad shallow tint softens the clipped shoreline instead of leaving
      // a hard blue-to-bed edge on every terrain triangle.
      float wetEdge = exp(-max(0.0, vWaterDepth) * 2.5);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.68, 0.61), wetEdge * 0.26);
      // Drift a low-contrast foam breakup through the first metre of water so
      // coves and river mouths do not read as a perfectly uniform ring.
      float foamNoise = texture2D(waterNormals, vWaterWorld.xz / 96.0 + vec2(worldWaterTime * 0.006, -worldWaterTime * 0.004)).r;
      float foamBand = smoothstep(0.54, 0.82, foamNoise) * (1.0 - smoothstep(0.12, 1.8, vWaterDepth));
      float weatherFoam = foamBand * (0.18 + waterRain * 0.18);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.54, 0.74, 0.66), weatherFoam);
      float riverRiffle = smoothstep(0.5, 0.82, texture2D(waterNormals,
        vec2(vWaterWorld.x / 115.0 + worldWaterTime * 0.014,
          vWaterWorld.z / 19.0 - worldWaterTime * 0.004)).g);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.55, 0.55), riverRiffle * riverMix * 0.34);
      float shoreBreak = smoothstep(0.46, 0.8, texture2D(waterNormals,
        vWaterWorld.xz / 58.0 - vec2(worldWaterTime * 0.008, worldWaterTime * 0.003)).b);
      float shoreFoam = (1.0 - smoothstep(0.08, 2.8, vWaterDepth)) *
        (0.12 + shoreBreak * 0.2) * (0.7 + waterRain * 0.25);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.56, 0.76, 0.69), shoreFoam);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.25, 0.36), waterSnow * 0.12);`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      float distanceFade = 1.0 - smoothstep(400.0, 3500.0, length(vWaterWorld - cameraPosition));
      vec2 p = vWaterWorld.xz;
      // Keep the accumulated phase independent of live weather blending. If
      // rain multiplied worldWaterTime here, a front transition would jump the
      // entire water pattern after the world had been running for a while.
      vec2 drift = vec2(worldWaterTime * 0.004, worldWaterTime * 0.002);
      vec2 rippleA = texture2D(waterNormals, p / 380.0 + drift).rg * 2.0 - 1.0;
      vec2 rippleB = texture2D(waterNormals, vec2(p.y, -p.x) / 113.0 - drift * 0.7).rg * 2.0 - 1.0;
      vec2 ripples = rippleA * (0.085 + waterRain * 0.045 + riverMix * 0.025) + rippleB * (0.035 + waterSnow * 0.01) * distanceFade;
      normal = normalize(normal + mat3(viewMatrix) * vec3(ripples.x, 0.0, ripples.y));
      float fresnel = 0.02 + 0.48 * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
      float glint = pow(max(0.0, rippleA.x + rippleB.y), 3.0) *
        (0.5 + 0.5 * sin(worldWaterTime * 0.7 + p.x * 0.002)) * (1.0 - waterSnow * 0.15);
      vec3 reflectedSky = vec3(0.18, 0.46, 0.58) + vec3(0.12, 0.16, 0.14) * glint;
      #ifdef USE_FOG
        reflectedSky = fogColor * 0.85;
      #endif
      totalEmissiveRadiance += reflectedSky * fresnel;`,
    )
  }
  material.customProgramCacheKey = () => 'calm-basin-water-weather-v8'
}
