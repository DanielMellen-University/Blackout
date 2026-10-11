import { MeshBasicMaterial, Vector3 } from 'three'

/** Three instanced draws, with optical shading and independent formation opacity. */
export function createCloudMaterial(sun: { value: Vector3 }, storm: { value: number }): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: 0xe8f0f8, transparent: true, opacity: .72, depthWrite: false })
  material.onBeforeCompile = shader => {
    shader.uniforms.cloudSun = sun
    shader.uniforms.cloudStorm = storm
    shader.vertexShader = `attribute float cloudAlpha;
      attribute float cloudTone;
      varying float vCloudTone;
      varying float vCloudAlpha;
      varying vec3 vCloudNormal;
      varying vec3 vCloudLocal;
      varying vec3 vCloudView;\n` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vCloudAlpha = cloudAlpha;
      vCloudTone = cloudTone;
      vCloudLocal = position;
      mat3 cloudTransform = mat3(instanceMatrix);
      vec3 cloudNormal = normal / max(vec3(dot(cloudTransform[0], cloudTransform[0]), dot(cloudTransform[1], cloudTransform[1]), dot(cloudTransform[2], cloudTransform[2])), vec3(.000001));
      vCloudNormal = normalize(mat3(modelMatrix) * cloudTransform * cloudNormal);
      vCloudView = normalize(cameraPosition - (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz);`)
    shader.fragmentShader = `uniform vec3 cloudSun;
      uniform float cloudStorm;
      varying float vCloudTone;
      varying float vCloudAlpha;
      varying vec3 vCloudNormal;
      varying vec3 vCloudLocal;
      varying vec3 vCloudView;\n` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 n = normalize(vCloudNormal);
      float facing = max(0.0, dot(n, normalize(vCloudView)));
      float billow = .88 + .12 * sin(vCloudLocal.x * 5.7 + sin(vCloudLocal.z * 4.1)) * sin(vCloudLocal.y * 3.9 + vCloudLocal.z * 2.7);
      float underside = smoothstep(-.8, .65, vCloudLocal.y);
      float sunlit = .5 + .5 * dot(n, cloudSun);
      float silver = pow(max(0.0, dot(normalize(vCloudView), -cloudSun)), 6.0) * pow(1.0 - facing, 2.0);
      diffuseColor.rgb *= mix(.68 - cloudStorm * .1, 1.0, underside) * (.86 + sunlit * .14) * billow;
      diffuseColor.rgb *= 1.0 - vCloudTone;
      diffuseColor.rgb += vec3(1.0, .94, .82) * silver * .08;
      // A broad optical edge lets overlapping billows form one bank, rather
      // than exposing the rim of each stretched sphere as a metallic disc.
      diffuseColor.a *= vCloudAlpha * pow(facing, 1.65) * billow;`)
  }
  material.customProgramCacheKey = () => 'cloud-optical-regional-v3'
  return material
}

/** Dense only inside the actual ellipsoid, with a broad soft outer boundary. */
export function cloudInteriorDensity(x: number, y: number, z: number): number {
  const radius = Math.hypot(x, y, z)
  if (!Number.isFinite(radius) || radius >= 1) return 0
  const t = Math.min(1, (1 - radius) / .55)
  return t * t * (3 - 2 * t)
}
