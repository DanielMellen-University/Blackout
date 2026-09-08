import {
  BackSide,
  Color,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'

const _dir = new Vector3()

/**
 * Weather values the sky needs to turn a generic blue gradient into a
 * readable front. This deliberately stays rendering-only: it is a compact
 * view of the director snapshot, not a second weather simulation.
 */
export interface SkyCloudInputs {
  lowClouds: number
  midClouds: number
  highClouds: number
  rain: number
  lightning: number
  windX: number
  windZ: number
}

/**
 * Blended controls for the dome's analytic cloud field. All coverage values
 * remain bounded so a weather transition cannot create a one-frame whiteout.
 */
export interface SkyCloudDeck {
  broken: number
  blanket: number
  cirrus: number
  storm: number
  darkness: number
  windX: number
  windZ: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function smooth01(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

/**
 * Keep the near instanced formations and the far sky deck in agreement.
 * Light weather exposes broken puffs and cirrus, while rain closes those gaps
 * into an undercast. Thunderstorms add darkness rather than a flash spike.
 */
export function deriveSkyCloudDeck(input: SkyCloudInputs): SkyCloudDeck {
  const low = clamp01(input.lowClouds)
  const mid = clamp01(input.midClouds)
  const high = clamp01(input.highClouds)
  const rain = clamp01(input.rain)
  const storm = smooth01((clamp01(input.lightning) - 0.22) / 0.78)
  const blanket = clamp01(mid * 0.62 + rain * 0.42 + storm * 0.2)

  return {
    // The blanket progressively fills the holes between individual clouds.
    broken: clamp01(low * (1 - blanket * 0.95) * (1 - storm * 0.25)),
    blanket,
    cirrus: clamp01(high * (1 - blanket * 0.72) * (1 - rain * 0.2)),
    storm,
    darkness: clamp01(blanket * 0.14 + rain * 0.26 + storm * 0.34),
    // The shader only needs a normalized drift vector. Capping it keeps a
    // blizzard from making the sky pattern race across a frame.
    windX: Math.max(-1, Math.min(1, input.windX / 34)),
    windZ: Math.max(-1, Math.min(1, input.windZ / 34)),
  }
}

/**
 * Full-sky dome with shader gradient, sun/moon discs, glow, and stars.
 * Centered on the player each frame so the sky always fills the background.
 */
export class SkyDome {
  readonly mesh: Mesh
  private readonly mat: ShaderMaterial
  private readonly top = new Color()
  private readonly horizon = new Color()

  constructor(scene: Scene) {
    this.mat = new ShaderMaterial({
      name: 'BlackoutSky',
      side: BackSide,
      depthWrite: false,
      // Test depth so nearer world occludes the dome, but don't write it
      depthTest: true,
      fog: false,
      uniforms: {
        uSunDir: { value: new Vector3(0, 1, 0) },
        uMoonDir: { value: new Vector3(0, -1, 0) },
        uTopColor: { value: new Color(0x6eb4d8) },
        uHorizonColor: { value: new Color(0xb8d4e8) },
        uDayFactor: { value: 1 },
        uNightFactor: { value: 0 },
        uDusk: { value: 0 },
        uSunIntensity: { value: 1 },
        uMoonIntensity: { value: 0.2 },
        uStarIntensity: { value: 0 },
        uHaze: { value: 0 },
        uTime: { value: 0 },
        // The far cloud deck is analytic inside this one existing draw. The
        // instanced meshes still supply close parallax and volume.
        uCloudBroken: { value: 0 },
        uCloudBlanket: { value: 0 },
        uCloudCirrus: { value: 0 },
        uCloudStorm: { value: 0 },
        uCloudDarkness: { value: 0 },
        uCloudWind: { value: new Vector2(0.1, 0.03) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(worldPos.xyz - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          // Push to far plane so nothing z-fights behind terrain at horizon
          gl_Position.z = gl_Position.w;
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec3 vWorldDir;

        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform float uDayFactor;
        uniform float uNightFactor;
        uniform float uDusk;
        uniform float uSunIntensity;
        uniform float uMoonIntensity;
        uniform float uStarIntensity;
        uniform float uHaze;
        uniform float uTime;
        uniform float uCloudBroken;
        uniform float uCloudBlanket;
        uniform float uCloudCirrus;
        uniform float uCloudStorm;
        uniform float uCloudDarkness;
        uniform vec2 uCloudWind;

        // Stable hash for star field
        float hash13(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        // Two cheap value-noise octaves make broad weather decks without a
        // texture fetch, extra mesh, or a fullscreen postprocess.
        float hash21(vec2 p) {
          p = fract(p * vec2(0.1031, 0.11369));
          p += dot(p, p.yx + 19.19);
          return fract((p.x + p.y) * p.x);
        }

        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
            f.y
          );
        }

        float cloudField(vec2 p) {
          float broad = valueNoise(p * 0.64);
          float detail = valueNoise(p * 1.72 + vec2(31.7, -12.4));
          return broad * 0.72 + detail * 0.28;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elev = dir.y; // -1..1

          // --- Base sky gradient (zenith → horizon → ground glow) ---
          float h = smoothstep(-0.15, 0.55, elev);
          vec3 col = mix(uHorizonColor, uTopColor, h);

          // Soft ground band under horizon (slightly darker)
          float ground = smoothstep(0.08, -0.35, elev);
          col = mix(col, uHorizonColor * 0.55, ground * 0.85);

          // --- Stars (night, upper sky) ---
          if (uStarIntensity > 0.01 && elev > -0.05) {
            // Dense layer
            vec3 cell = floor(dir * 220.0);
            float n = hash13(cell);
            float star = step(0.992, n);
            // Sparse bright stars
            float n2 = hash13(cell + 19.7);
            float bright = step(0.9975, n2);
            // Gentle twinkle
            float tw = 0.75 + 0.25 * sin(uTime * (2.0 + n * 4.0) + n2 * 40.0);
            float skyMask = smoothstep(-0.02, 0.25, elev);
            float starVis = (star * 0.55 + bright * 1.0) * tw * skyMask * uStarIntensity;
            // Dim near sun/moon
            float nearSun = pow(max(0.0, dot(dir, uSunDir)), 16.0);
            starVis *= 1.0 - nearSun * uDayFactor;
            col += vec3(0.85, 0.9, 1.0) * starVis;
          }

          // --- Sun disc + atmospheric scatter (cheap rayleigh-ish) ---
          vec3 sunD = normalize(uSunDir);
          vec3 moonD = normalize(uMoonDir);
          float sunDot = max(0.0, dot(dir, sunD));
          float sunCore = smoothstep(0.9994, 0.99992, sunDot);
          float sunHalo =
            pow(sunDot, 56.0) * 1.0 +
            pow(sunDot, 14.0) * 0.4 +
            pow(sunDot, 3.5) * 0.18;
          // Broad sky wash from the sun (lights the sky dome, not the world)
          float sunScatter = pow(sunDot, 1.6) * 0.22 + pow(sunDot, 0.65) * 0.08;
          float lowSun = 1.0 - smoothstep(0.0, 0.35, sunD.y);
          vec3 sunCol = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.97, 0.88), smoothstep(-0.1, 0.4, sunD.y));
          sunCol = mix(sunCol, vec3(1.0, 0.32, 0.08), lowSun * 0.6 * uDusk);
          col += sunCol * (sunCore * 2.6 + sunHalo * 1.15 + sunScatter) * uSunIntensity;

          float sunAz = max(0.0, dot(normalize(vec3(dir.x, 0.0, dir.z) + 1e-4),
                                      normalize(vec3(sunD.x, 0.0, sunD.z) + 1e-4)));
          float duskWash = pow(sunAz, 2.5) * smoothstep(0.28, -0.08, elev) * uDusk * uSunIntensity;
          col += vec3(1.0, 0.32, 0.1) * duskWash * 0.55;

          // --- Moon disc + cool night scatter ---
          float moonDot = max(0.0, dot(dir, moonD));
          float moonCore = smoothstep(0.99955, 0.9999, moonDot);
          float moonHalo = pow(moonDot, 90.0) * 0.65 + pow(moonDot, 22.0) * 0.22;
          float moonScatter = pow(moonDot, 2.2) * 0.16 + pow(moonDot, 0.8) * 0.05;
          vec3 moonCol = vec3(0.78, 0.86, 1.0);
          float phase = moonCore * (0.65 + 0.35 * sunDot);
          col += moonCol * (phase * 1.5 + moonHalo + moonScatter) * uMoonIntensity;
          // Cool night horizon wash under the moon
          float moonAz = max(0.0, dot(normalize(vec3(dir.x, 0.0, dir.z) + 1e-4),
                                       normalize(vec3(moonD.x, 0.0, moonD.z) + 1e-4)));
          col += vec3(0.25, 0.35, 0.65) * pow(moonAz, 2.0) *
            smoothstep(0.2, -0.15, elev) * uMoonIntensity * 0.35;

          // --- Weather deck ---
          // The projected direction keeps this field stable as the dome
          // follows the aircraft. Fade it before the ground band so it cannot
          // form a hard line at the horizon.
          float deckSky = smoothstep(-0.08, 0.17, elev);
          if (deckSky > 0.001) {
            vec2 projected = dir.xz / max(0.24, elev + 0.34);
            vec2 drift = uCloudWind * uTime * 0.018;
            float wisps = cloudField(projected * 0.78 + drift * 0.65);
            float puffs = smoothstep(0.58, 0.83,
              cloudField(projected * 1.16 + drift));
            float broad = smoothstep(0.24, 0.79,
              cloudField(projected * 0.54 + drift * 0.4 + vec2(7.2, 18.1)));
            float stormCells = smoothstep(0.48, 0.84,
              cloudField(projected * 0.88 + drift * 0.55 + vec2(-16.3, 9.7)));

            float cirrus = smoothstep(0.62, 0.88, wisps) * uCloudCirrus * 0.34;
            float broken = puffs * uCloudBroken * 0.72;
            // Even the darkest fronts retain soft internal variation rather
            // than reading as an opaque flat ceiling.
            float blanket = uCloudBlanket * mix(0.7, 1.0, broad);
            float storm = uCloudStorm * mix(0.5, 1.0, stormCells);
            float cloudAlpha = clamp(cirrus + broken * (1.0 - cirrus) +
              blanket * (1.0 - cirrus) * (1.0 - broken * 0.38), 0.0, 0.96);
            cloudAlpha = max(cloudAlpha, storm * 0.22) * deckSky;

            float sunSoft = 0.58 + max(0.0, dot(dir, sunD)) * 0.28;
            vec3 fairCloud = mix(vec3(0.82, 0.89, 0.95), vec3(0.44, 0.54, 0.65),
              uCloudDarkness) * sunSoft;
            vec3 stormCloud = mix(vec3(0.31, 0.39, 0.49), vec3(0.15, 0.22, 0.31),
              stormCells * 0.72);
            vec3 cloudColor = mix(fairCloud, stormCloud, uCloudStorm * 0.82);
            col = mix(col, cloudColor, cloudAlpha);
          }

          // Haze / overcast: flatten sky + mute celestial bodies a bit
          col = mix(col, uHorizonColor * 0.85, uHaze * 0.45);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })

    // Large dome; verts pushed to far plane in the vertex shader
    const geo = new SphereGeometry(1, 24, 16)
    this.mesh = new Mesh(geo, this.mat)
    this.mesh.name = 'SkyDome'
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1000
    this.mesh.scale.setScalar(9000)
    scene.add(this.mesh)
  }

  /**
   * @param ax player position (dome follows)
   * @param sunDir world direction toward the sun (normalized-ish)
   * @param dayFactor 0 night → 1 day
   * @param dusk 0–1 dawn/dusk warmth
   * @param topColor zenith
   * @param horizonColor horizon band
   * @param haze weather haze 0–1
   * @param cloudDeck blended analytic deck controls from the weather front
   * @param timeSec for star twinkle
   */
  update(
    ax: number,
    ay: number,
    az: number,
    sunDir: Vector3,
    dayFactor: number,
    dusk: number,
    topColor: Color,
    horizonColor: Color,
    haze: number,
    cloudDeck: SkyCloudDeck,
    timeSec: number,
  ): void {
    this.mesh.position.set(ax, ay, az)

    _dir.copy(sunDir).normalize()
    this.mat.uniforms.uSunDir!.value.copy(_dir)
    // Moon opposite the sun on the same orbital plane
    this.mat.uniforms.uMoonDir!.value.copy(_dir).multiplyScalar(-1)

    this.top.copy(topColor)
    this.horizon.copy(horizonColor)
    this.mat.uniforms.uTopColor!.value.copy(this.top)
    this.mat.uniforms.uHorizonColor!.value.copy(this.horizon)

    const night = 1 - dayFactor
    const cloudCover = MathUtilsClamp(
      cloudDeck.cirrus * 0.16 + cloudDeck.broken * 0.54 + cloudDeck.blanket * 0.9,
      0,
      1,
    )
    const clearSky = 1 - MathUtilsClamp(cloudCover * 0.85 + haze * 0.35, 0, 0.92)

    this.mat.uniforms.uDayFactor!.value = dayFactor
    this.mat.uniforms.uNightFactor!.value = night
    this.mat.uniforms.uDusk!.value = dusk
    this.mat.uniforms.uHaze!.value = haze
    this.mat.uniforms.uTime!.value = timeSec
    this.mat.uniforms.uCloudBroken!.value = cloudDeck.broken
    this.mat.uniforms.uCloudBlanket!.value = cloudDeck.blanket
    this.mat.uniforms.uCloudCirrus!.value = cloudDeck.cirrus
    this.mat.uniforms.uCloudStorm!.value = cloudDeck.storm
    this.mat.uniforms.uCloudDarkness!.value = cloudDeck.darkness
    ;(this.mat.uniforms.uCloudWind!.value as Vector2).set(cloudDeck.windX, cloudDeck.windZ)

    // Sun bright in day; soft at dusk; gone fully under horizon
    const sunUp = MathUtilsClamp((_dir.y + 0.08) / 0.5, 0, 1)
    this.mat.uniforms.uSunIntensity!.value =
      (0.15 + dayFactor * 0.95) * sunUp * clearSky

    // Moon opposite: visible when sun is low / night
    const moonUp = MathUtilsClamp((-_dir.y + 0.05) / 0.45, 0, 1)
    this.mat.uniforms.uMoonIntensity!.value =
      (0.15 + night * 0.95) * moonUp * clearSky

    // Stars only at night, clear weather
    this.mat.uniforms.uStarIntensity!.value =
      Math.pow(night, 1.35) * clearSky * (0.55 + (1 - haze) * 0.45)
  }
}

function MathUtilsClamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x))
}
