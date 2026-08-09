import {
  BackSide,
  Color,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'

const _dir = new Vector3()

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

        // Stable hash for star field
        float hash13(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
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

          // --- Sun disc + atmospheric glow ---
          float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
          // Core disc
          float sunCore = smoothstep(0.9994, 0.99992, sunDot);
          // Soft corona
          float sunHalo = pow(sunDot, 48.0) * 0.9 + pow(sunDot, 12.0) * 0.35 + pow(sunDot, 4.0) * 0.12;
          // Horizon scatter when sun is low
          float lowSun = 1.0 - smoothstep(0.0, 0.35, uSunDir.y);
          vec3 sunCol = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.96, 0.85), smoothstep(-0.1, 0.4, uSunDir.y));
          sunCol = mix(sunCol, vec3(1.0, 0.35, 0.1), lowSun * 0.55 * uDusk);
          col += sunCol * (sunCore * 2.4 + sunHalo * 1.1) * uSunIntensity;
          // Warm horizon wash around sun azimuth during dusk
          float sunAz = max(0.0, dot(normalize(vec3(dir.x, 0.0, dir.z) + 1e-4),
                                      normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4)));
          float duskWash = pow(sunAz, 3.0) * smoothstep(0.25, -0.05, elev) * uDusk * uSunIntensity;
          col += vec3(1.0, 0.35, 0.12) * duskWash * 0.45;

          // --- Moon disc + soft glow ---
          float moonDot = max(0.0, dot(dir, normalize(uMoonDir)));
          float moonCore = smoothstep(0.99955, 0.9999, moonDot);
          float moonHalo = pow(moonDot, 80.0) * 0.55 + pow(moonDot, 20.0) * 0.18;
          vec3 moonCol = vec3(0.82, 0.88, 1.0);
          // Subtle lunar shading (fake phase via gradient across disc)
          float phase = moonCore * (0.7 + 0.3 * sunDot);
          col += moonCol * (phase * 1.35 + moonHalo) * uMoonIntensity;

          // Haze / overcast: flatten sky + mute celestial bodies a bit
          col = mix(col, uHorizonColor * 0.85, uHaze * 0.45);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })

    // Large dome; verts pushed to far plane in the vertex shader
    const geo = new SphereGeometry(1, 48, 32)
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
   * @param cloudCover reduces sun/moon/stars
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
    cloudCover: number,
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
    const clearSky = 1 - MathUtilsClamp(cloudCover * 0.85 + haze * 0.35, 0, 0.92)

    this.mat.uniforms.uDayFactor!.value = dayFactor
    this.mat.uniforms.uNightFactor!.value = night
    this.mat.uniforms.uDusk!.value = dusk
    this.mat.uniforms.uHaze!.value = haze
    this.mat.uniforms.uTime!.value = timeSec

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
