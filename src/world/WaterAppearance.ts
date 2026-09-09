import type { MeshStandardMaterial } from 'three'
import { waterNormals } from './WaterNormals'

export interface WaterWeatherUniforms {
  rain: { value: number }
  snow: { value: number }
  windX?: { value: number }
  windZ?: { value: number }
}

const DEFAULT_WEATHER: Required<WaterWeatherUniforms> = {
  rain: { value: 0 },
  snow: { value: 0 },
  windX: { value: 0 },
  windZ: { value: 0 },
}

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
    shader.uniforms.waterWindX = weather.windX ?? DEFAULT_WEATHER.windX
    shader.uniforms.waterWindZ = weather.windZ ?? DEFAULT_WEATHER.windZ
    shader.uniforms.waterNormals = { value: waterNormals }
    shader.vertexShader = 'attribute float waterDepth;\nattribute float waterFlow;\nattribute vec2 waterFlowDir;\nattribute float waterKind;\nattribute float waterDrop;\nvarying float vWaterDepth;\nvarying float vWaterFlow;\nvarying vec2 vWaterFlowDir;\nvarying float vWaterKind;\nvarying float vWaterDrop;\nvarying vec3 vWaterWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvWaterDepth = waterDepth;\nvWaterFlow = waterFlow;\nvWaterFlowDir = waterFlowDir;\nvWaterKind = waterKind;\nvWaterDrop = waterDrop;\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = 'uniform float worldWaterTime;\nuniform float waterRain;\nuniform float waterSnow;\nuniform float waterWindX;\nuniform float waterWindZ;\nuniform sampler2D waterNormals;\nvarying float vWaterDepth;\nvarying float vWaterFlow;\nvarying float vWaterKind;\nvarying float vWaterDrop;\nvarying vec2 vWaterFlowDir;\nvarying vec3 vWaterWorld;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nfloat waterSpecField = texture2D(waterNormals, vWaterWorld.xz / 170.0 + vec2(worldWaterTime * .0025, -worldWaterTime * .0018)).g;\nfloat waterSpecMask = smoothstep(.36, .78, waterSpecField);\nroughnessFactor = mix(roughnessFactor, .12 + waterRain * .12 + waterSnow * .04, waterSpecMask * (.28 + vWaterFlow * .18));',
    ).replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float depthMix = 1.0 - exp(-vWaterDepth * 0.085);
      // Keep one batched water material, but let geometry carry the body kind
      // so rivers, ponds, lakes, and seas do not collapse into one teal sheet.
      // Kind 0 = river, .5 = pond, 1 = lake, 2 = sea.
      float lakeMix = smoothstep(.08, .92, vWaterKind);
      float seaMix = smoothstep(1.24, 1.92, vWaterKind);
      vec3 shallowWater = mix(vec3(0.03, 0.28, 0.34), vec3(0.075, 0.34, 0.38), lakeMix);
      shallowWater = mix(shallowWater, vec3(0.025, 0.18, 0.3), seaMix);
      vec3 deepWater = mix(vec3(0.008, 0.1, 0.14), vec3(0.012, 0.065, 0.14), lakeMix);
      deepWater = mix(deepWater, vec3(0.006, 0.032, 0.11), seaMix);
      diffuseColor.rgb = mix(shallowWater, deepWater, depthMix);
      float riverMix = smoothstep(0.2, 0.8, vWaterFlow);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.028, 0.28, 0.34), riverMix * 0.58);
      float riverDepthBand = smoothstep(0.32, 2.8, vWaterDepth) * riverMix;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018, 0.16, 0.23), riverDepthBand * 0.52);
      // Two broad, moving bands break up the old single-color sheet without
      // turning the surface into noisy pixel glitter. The same field drives
      // every tile, so catchment borders keep a continuous water pattern.
      vec2 weatherDrift = vec2(waterWindX, waterWindZ) * worldWaterTime * 0.00055;
      vec2 colorDrift = weatherDrift + vec2(worldWaterTime * 0.0015, -worldWaterTime * 0.0011);
      float patchA = texture2D(waterNormals, vWaterWorld.xz / 230.0 + colorDrift).r;
      float patchB = texture2D(waterNormals, vec2(vWaterWorld.z, -vWaterWorld.x) / 510.0 - colorDrift * 0.6).g;
      float waterPattern = smoothstep(0.22, 0.78, patchA * 0.62 + patchB * 0.38);
      diffuseColor.rgb *= 0.8 + waterPattern * 0.36;
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
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.5, 0.56), riverRiffle * riverMix * 0.48);
      float cascadeFoam = smoothstep(.18, .72, vWaterDrop) * riverMix;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.48, .76, .78),
        cascadeFoam * (.22 + waterRain * .1));
      // Long broken streaks make rivers read as moving water at flight scale.
      // Two oblique axes keep the pattern from looking like a tiled stripe
      // texture when a reach turns through the terrain.
      vec2 flowAxisA = normalize(vWaterFlowDir + vec2(0.0001));
      vec2 flowAxisB = vec2(-flowAxisA.y, flowAxisA.x);
      vec2 flowUvA = vec2(dot(vWaterWorld.xz, flowAxisA) / 72.0 + worldWaterTime * 0.018,
        dot(vWaterWorld.xz, flowAxisB) / 13.0 - worldWaterTime * 0.002);
      vec2 flowUvB = vec2(dot(vWaterWorld.xz, flowAxisB) / 94.0 - worldWaterTime * 0.014,
        dot(vWaterWorld.xz, flowAxisA) / 17.0 + worldWaterTime * 0.0025);
      float flowStreak = smoothstep(0.42, 0.76,
        texture2D(waterNormals, flowUvA).g * 0.68 + texture2D(waterNormals, flowUvB).r * 0.32);
      float flowSpark = smoothstep(0.68, 0.92, texture2D(waterNormals,
        flowUvA * 0.72 + vec2(0.17, -0.31)).r);
      float flowPulse = 0.72 + 0.28 * sin(worldWaterTime * 0.55 + dot(vWaterWorld.xz, flowAxisA) * 0.012);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.61, 0.67), flowStreak * riverMix * 0.72 * flowPulse);
      diffuseColor.rgb += vec3(0.05, 0.15, 0.16) * flowSpark * riverMix;
      float riverBankFoam = smoothstep(0.48, 0.84, texture2D(waterNormals,
        vWaterWorld.xz / 41.0 + vec2(worldWaterTime * 0.009, -worldWaterTime * 0.006)).b);
      riverBankFoam *= riverMix * (1.0 - smoothstep(0.04, 0.9, vWaterDepth));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.86, 0.79), riverBankFoam * 0.34);
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
      vec2 drift = vec2(worldWaterTime * 0.004, worldWaterTime * 0.002) +
        vec2(waterWindX, waterWindZ) * worldWaterTime * 0.0011;
      vec2 rippleA = texture2D(waterNormals, p / 380.0 + drift).rg * 2.0 - 1.0;
      vec2 rippleB = texture2D(waterNormals, vec2(p.y, -p.x) / 113.0 - drift * 0.7).rg * 2.0 - 1.0;
      vec2 ripples = rippleA * (0.085 + waterRain * 0.045 + riverMix * 0.025 + vWaterDrop * .035) +
        rippleB * (0.035 + waterSnow * 0.01) * distanceFade;
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
  material.customProgramCacheKey = () => 'calm-basin-water-weather-v10'
}
