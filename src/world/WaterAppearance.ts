import type { MeshStandardMaterial } from 'three'
import { waterNormals } from './WaterNormals'

export interface WaterWeatherUniforms {
  rain: { value: number }
  snow: { value: number }
  windX?: { value: number }
  windZ?: { value: number }
}

const DEFAULT_WATER_DETAIL_SCALE = { value: 1 }

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
  detailScale: { value: number } = DEFAULT_WATER_DETAIL_SCALE,
): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.worldWaterTime = clock
    shader.uniforms.waterRain = weather.rain
    shader.uniforms.waterSnow = weather.snow
    shader.uniforms.waterWindX = weather.windX ?? DEFAULT_WEATHER.windX
    shader.uniforms.waterWindZ = weather.windZ ?? DEFAULT_WEATHER.windZ
    shader.uniforms.waterDetailScale = detailScale
    shader.uniforms.waterNormals = { value: waterNormals }
    shader.vertexShader = 'attribute float waterDepth;\nattribute float waterFlow;\nattribute vec2 waterFlowDir;\nattribute float waterKind;\nattribute float waterDrop;\nvarying float vWaterDepth;\nvarying float vWaterFlow;\nvarying vec2 vWaterFlowDir;\nvarying float vWaterKind;\nvarying float vWaterDrop;\nvarying vec3 vWaterWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvWaterDepth = waterDepth;\nvWaterFlow = waterFlow;\nvWaterFlowDir = waterFlowDir;\nvWaterKind = waterKind;\nvWaterDrop = waterDrop;\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = 'uniform float worldWaterTime;\nuniform float waterRain;\nuniform float waterSnow;\nuniform float waterWindX;\nuniform float waterWindZ;\nuniform float waterDetailScale;\nuniform sampler2D waterNormals;\nvarying float vWaterDepth;\nvarying float vWaterFlow;\nvarying float vWaterKind;\nvarying float vWaterDrop;\nvarying vec2 vWaterFlowDir;\nvarying vec3 vWaterWorld;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nfloat waterDetail = clamp(waterDetailScale, 0.0, 1.0);\nfloat waterSpecField = 0.5;\nfloat waterSpecDistanceFade = 1.0 - smoothstep(480.0, 3600.0, waterPixelDistance);\n// Keep texture reads off for Low quality and distant water.\nif (waterDetail > 0.05 && waterSpecDistanceFade > 0.01) {\n  waterSpecField = texture2D(waterNormals, vWaterWorld.xz / 170.0 + vec2(worldWaterTime * .0025, -worldWaterTime * .0018)).g;\n}\nfloat waterSpecMask = smoothstep(.36, .78, waterSpecField);\nroughnessFactor = mix(roughnessFactor, .12 + waterRain * .12 + waterSnow * .04, waterSpecMask * (.28 + vWaterFlow * .18 * depthDetail) * waterDetail * waterSpecDistanceFade);',
    ).replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      // Evaluate once per pixel: interpolating nonlinear vertex-distance fades
      // changes the same water's shading whenever a streamed LOD changes.
      float waterPixelDistance = length(vWaterWorld - cameraPosition);
      float fineWaterDetail = clamp(waterDetailScale, 0.0, 1.0);
      // At flight distance, per-vertex shallow profiles expose large ribbon
      // triangles rather than useful underwater detail. Fade that optical
      // detail per pixel, without changing coverage or physical water depth.
      float depthDetail = 1.0 - smoothstep(450.0, 1800.0, waterPixelDistance);
      float depthMix = mix(1.0, 1.0 - exp(-vWaterDepth * 0.8), depthDetail);
      // High-frequency foam and riffles alias badly at flight distance. Keep
      // broad water-body breakup visible, but fade fine detail before the
      // terrain fog so distant lakes and rivers read as clean surfaces.
      float waterDistanceFade = (1.0 - smoothstep(520.0, 4200.0, waterPixelDistance)) * fineWaterDetail;
      // Connected freshwater shares one palette. Flow remains a ripple/foam
      // cue, not a second teal paint layer that exposes confluence triangles.
      // Kind still distinguishes sea water; freshwater boundaries are optical,
      // not a hard river-versus-lake material switch.
      float seaMix = smoothstep(1.24, 1.92, vWaterKind);
      vec3 shallowWater = vec3(0.03, 0.21, 0.29);
      shallowWater = mix(shallowWater, vec3(0.025, 0.18, 0.3), seaMix);
      vec3 deepWater = vec3(0.008, 0.065, 0.12);
      deepWater = mix(deepWater, vec3(0.006, 0.032, 0.11), seaMix);
      diffuseColor.rgb = mix(shallowWater, deepWater, depthMix);
      float riverMix = smoothstep(0.2, 0.8, vWaterFlow) * depthDetail;
      // Two broad, moving bands break up the old single-color sheet without
      // turning the surface into noisy pixel glitter. The same field drives
      // every tile, so catchment borders keep a continuous water pattern.
      vec2 colorDrift = vec2(worldWaterTime * 0.0015, -worldWaterTime * 0.0011);
      float waterPattern = 0.5;
      if (fineWaterDetail > 0.05 && waterDistanceFade > 0.01) {
        float patchA = texture2D(waterNormals, vWaterWorld.xz / 230.0 + colorDrift).r;
        float patchB = texture2D(waterNormals, vec2(vWaterWorld.z, -vWaterWorld.x) / 510.0 - colorDrift * 0.6).g;
        waterPattern = mix(0.5, smoothstep(0.22, 0.78, patchA * 0.62 + patchB * 0.38), waterDistanceFade);
      }
      diffuseColor.rgb *= 0.8 + waterPattern * 0.36;
      // Add a slow analytic body field so distant water does not collapse into
      // one cyan ribbon after high-frequency detail fades. It is continuous
      // across streamed tiles and costs only ALU, not another texture fetch.
      float broadBodyField = 0.5 + 0.5 * sin(
        vWaterWorld.x * 0.0031 + sin(vWaterWorld.z * 0.0023) * 1.7 +
        vWaterWorld.z * 0.0009);
      broadBodyField = smoothstep(0.16, 0.84, broadBodyField);
      float bodyContrast = mix(0.84, 1.14, broadBodyField);
      bodyContrast = mix(1.0, bodyContrast, 0.68 + seaMix * 0.18);
      diffuseColor.rgb *= bodyContrast;
      // A broad shallow tint softens the clipped shoreline instead of leaving
      // a hard blue-to-bed edge on every terrain triangle.
      float wetEdge = exp(-max(0.0, vWaterDepth) * 2.5) * depthDetail;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.68, 0.61), wetEdge * 0.26);
      // Drift a low-contrast foam breakup through the first metre of water so
      // coves and river mouths do not read as a perfectly uniform ring.
      float foamNoise = 0.5;
      if (fineWaterDetail > 0.05 && waterDistanceFade > 0.01) {
        foamNoise = texture2D(waterNormals, vWaterWorld.xz / 96.0 + vec2(worldWaterTime * 0.006, -worldWaterTime * 0.004)).r;
      }
      float foamBand = smoothstep(0.54, 0.82, foamNoise) * (1.0 - smoothstep(0.12, 1.8, vWaterDepth)) * depthDetail;
      float weatherFoam = foamBand * (0.18 + waterRain * 0.18) * waterDistanceFade;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.54, 0.74, 0.66), weatherFoam);
      float riverRiffle = 0.5;
      if (fineWaterDetail > 0.05 && waterDistanceFade > 0.01 && riverMix > 0.01) {
        riverRiffle = smoothstep(0.5, 0.82, texture2D(waterNormals,
          vec2(vWaterWorld.x / 115.0 + worldWaterTime * 0.014,
            vWaterWorld.z / 19.0 - worldWaterTime * 0.004)).g);
      }
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.3, 0.35), riverRiffle * riverMix * 0.32 * waterDistanceFade);
      float cascadeFoam = smoothstep(.18, .72, vWaterDrop) * riverMix;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.3, .58, .62),
        cascadeFoam * (.22 + waterRain * .1) * waterDistanceFade);
      // Long broken streaks make rivers read as moving water at flight scale.
      // Two oblique axes keep the pattern from looking like a tiled stripe
      // texture when a reach turns through the terrain.
      vec2 flowAxisA = normalize(vWaterFlowDir + vec2(0.0001));
      vec2 flowAxisB = vec2(-flowAxisA.y, flowAxisA.x);
      float flowStreak = 0.5;
      float flowSpark = 0.0;
      if (fineWaterDetail > 0.05 && waterDistanceFade > 0.01 && riverMix > 0.01) {
        vec2 flowUvA = vec2(dot(vWaterWorld.xz, flowAxisA) / 72.0 + worldWaterTime * 0.018,
          dot(vWaterWorld.xz, flowAxisB) / 13.0 - worldWaterTime * 0.002);
        vec2 flowUvB = vec2(dot(vWaterWorld.xz, flowAxisB) / 94.0 - worldWaterTime * 0.014,
          dot(vWaterWorld.xz, flowAxisA) / 17.0 + worldWaterTime * 0.0025);
        flowStreak = smoothstep(0.42, 0.76,
          texture2D(waterNormals, flowUvA).g * 0.68 + texture2D(waterNormals, flowUvB).r * 0.32);
        flowSpark = smoothstep(0.68, 0.92, texture2D(waterNormals,
          flowUvA * 0.72 + vec2(0.17, -0.31)).r);
      }
      float flowPulse = 0.72 + 0.28 * sin(worldWaterTime * 0.55 + dot(vWaterWorld.xz, flowAxisA) * 0.012);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.075, 0.34, 0.39), flowStreak * riverMix * 0.38 * flowPulse * mix(.22, 1.0, waterDistanceFade));
      diffuseColor.rgb += vec3(0.025, 0.09, 0.1) * flowSpark * riverMix * waterDistanceFade;
      float riverBankFoam = 0.5;
      if (fineWaterDetail > 0.05 && waterDistanceFade > 0.01 && riverMix > 0.01) {
        riverBankFoam = smoothstep(0.48, 0.84, texture2D(waterNormals,
          vWaterWorld.xz / 41.0 + vec2(worldWaterTime * 0.009, -worldWaterTime * 0.006)).b);
      }
      riverBankFoam *= riverMix * (1.0 - smoothstep(0.04, 0.9, vWaterDepth)) * depthDetail;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.74, 0.69), riverBankFoam * 0.24 * waterDistanceFade);
      float shoreBreak = 0.5;
      if (fineWaterDetail > 0.05 && waterDistanceFade > 0.01) {
        shoreBreak = smoothstep(0.46, 0.8, texture2D(waterNormals,
          vWaterWorld.xz / 58.0 - vec2(worldWaterTime * 0.008, worldWaterTime * 0.003)).b);
      }
      float shoreFoam = (1.0 - smoothstep(0.08, 2.8, vWaterDepth)) *
        (0.12 + shoreBreak * 0.2) * (0.7 + waterRain * 0.25) * depthDetail;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.56, 0.76, 0.69), shoreFoam * fineWaterDetail * mix(.35, 1.0, waterDistanceFade));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.25, 0.36), waterSnow * 0.12);`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      float waterNormalDetail = clamp(waterDetailScale, 0.0, 1.0);
      float distanceFade = 1.0 - smoothstep(400.0, 3500.0, waterPixelDistance);
      vec2 p = vWaterWorld.xz;
      // Live wind changes ripple strength, never elapsed-time phase. Otherwise
      // a weather update jumps the whole texture, amplified by session length.
      vec2 drift = vec2(worldWaterTime * 0.004, worldWaterTime * 0.002);
      float windRippleStrength = min(length(vec2(waterWindX, waterWindZ)) * .08, .06);
      vec2 rippleA = vec2(0.0);
      vec2 rippleB = vec2(0.0);
      if (waterNormalDetail > 0.05 && distanceFade > 0.01) {
        rippleA = texture2D(waterNormals, p / 380.0 + drift).rg * 2.0 - 1.0;
        rippleB = texture2D(waterNormals, vec2(p.y, -p.x) / 113.0 - drift * 0.7).rg * 2.0 - 1.0;
      }
      vec2 ripples = rippleA * (0.085 + windRippleStrength + waterRain * 0.045 + riverMix * 0.025 + vWaterDrop * .035 * depthDetail) * distanceFade * waterNormalDetail +
        rippleB * (0.035 + waterSnow * 0.01) * distanceFade * waterNormalDetail;
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
  material.customProgramCacheKey = () => 'calm-basin-water-weather-v20'
}
