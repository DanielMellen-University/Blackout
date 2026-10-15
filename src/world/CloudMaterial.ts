import { MeshBasicMaterial, Vector3 } from 'three'

/** Three instanced draws, with optical shading and independent formation opacity. */
export function createCloudMaterial(sun: { value: Vector3 }, storm: { value: number },
  drift = { value: new Vector3() }, blend = { value: 1 },
  flashPosition = { value: new Vector3() }, flash = { value: 0 }): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: 0xe8f0f8, transparent: true, opacity: .72, depthWrite: false })
  material.onBeforeCompile = shader => {
    shader.uniforms.cloudSun = sun
    shader.uniforms.cloudStorm = storm
    shader.uniforms.cloudDrift = drift
    shader.uniforms.cloudFrameBlend = blend
    shader.uniforms.cloudFlashPosition = flashPosition
    shader.uniforms.cloudFlash = flash
    shader.vertexShader = `attribute float cloudAlpha;
      attribute float cloudAlphaFrom;
      attribute float cloudTone;
      uniform vec3 cloudDrift;
      uniform float cloudFrameBlend;
      varying float vCloudTone;
      varying float vCloudAlpha;
      varying vec3 vCloudNormal;
      varying vec3 vCloudLocal;
      varying vec3 vCloudView;\n` + shader.vertexShader
    shader.vertexShader = 'varying vec3 vCloudWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      mvPosition.xyz += (viewMatrix * vec4(cloudDrift, 0.0)).xyz;
      gl_Position = projectionMatrix * mvPosition;
      vCloudAlpha = mix(cloudAlphaFrom, cloudAlpha, clamp(cloudFrameBlend, 0.0, 1.0));
      vCloudTone = cloudTone;
      vCloudLocal = position;
      vCloudWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz + cloudDrift;
      mat3 cloudTransform = mat3(instanceMatrix);
      vec3 cloudNormal = normal / max(vec3(dot(cloudTransform[0], cloudTransform[0]), dot(cloudTransform[1], cloudTransform[1]), dot(cloudTransform[2], cloudTransform[2])), vec3(.000001));
      vCloudNormal = normalize(mat3(modelMatrix) * cloudTransform * cloudNormal);
      vCloudView = normalize(cameraPosition - (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz - cloudDrift);`)
    shader.fragmentShader = `uniform vec3 cloudFlashPosition;
      uniform float cloudFlash;
      varying vec3 vCloudWorld;
      uniform vec3 cloudSun;
      uniform float cloudStorm;
      varying float vCloudTone;
      varying float vCloudAlpha;
      varying vec3 vCloudNormal;
      varying vec3 vCloudLocal;
      varying vec3 vCloudView;\n` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 n = normalize(vCloudNormal);
      float facing = max(0.0, dot(n, normalize(vCloudView)));
      float billow = .84 + .16 * sin(vCloudLocal.x * 7.7 + sin(vCloudLocal.z * 5.1)) * sin(vCloudLocal.y * 6.9 + vCloudLocal.z * 4.7);
      float underside = smoothstep(-.65, .55, n.y);
      float sunlit = .5 + .5 * dot(n, cloudSun);
      diffuseColor.rgb *= mix(.70 - cloudStorm * .08, 1.0, underside) * (.86 + sunlit * .14) * (.94 + billow * .06);
      diffuseColor.rgb *= 1.0 - vCloudTone;
      if (cloudFlash > .001) {
        vec3 delta = (vCloudWorld - cloudFlashPosition) / vec3(2200.0, 1400.0, 2200.0);
        float glow = exp(-dot(delta, delta) * 2.0) * cloudFlash;
        diffuseColor.rgb += vec3(.72, .84, 1.0) * glow;
      }
      // Approximate optical depth through a billow: dense core, soft boundary.
      // A steep facing-power erased most of each sphere and exposed separate
      // translucent discs; no ray marching or extra draw is needed here.
      float edge = (1.0 - exp(-facing * 3.6)) * smoothstep(.08, .55, billow - (1.0 - facing) * .35);
      diffuseColor.a *= vCloudAlpha * edge * (.8 + billow * .2);`)
  }
  material.customProgramCacheKey = () => 'cloud-optical-depth-v6'
  return material
}

/** Dense only inside the actual ellipsoid, with a broad soft outer boundary. */
export function cloudInteriorDensity(x: number, y: number, z: number): number {
  const radius = Math.hypot(x, y, z)
  if (!Number.isFinite(radius) || radius >= 1) return 0
  const t = Math.min(1, (1 - radius) / .55)
  return t * t * (3 - 2 * t)
}
