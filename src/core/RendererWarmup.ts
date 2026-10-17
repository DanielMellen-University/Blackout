import type { Camera, Object3D, Scene, WebGLRenderer } from 'three'

export type WarmupRenderer = Pick<WebGLRenderer, 'compileAsync' | 'render' | 'getContext'>

/** Compilation alone leaves first-use uniform queries and driver pipelines
 * deferred. Exercise the real variants privately before flight, then wait
 * without blocking the main thread for the submitted GPU work to finish. */
export async function warmupMaterials(renderer: WarmupRenderer, fixtures: Object3D,
  camera: Camera, scene: Scene): Promise<void> {
  await renderer.compileAsync(fixtures, camera, scene)
  fixtures.traverse(object => { object.frustumCulled = false })
  scene.add(fixtures)
  try {
    renderer.render(scene, camera)
    const gl = renderer.getContext()
    if (!('fenceSync' in gl) || gl.isContextLost()) return
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    if (!fence) return
    try {
      gl.flush()
      const deadline = performance.now() + 5000
      while (!gl.isContextLost() && performance.now() < deadline) {
        const status = gl.clientWaitSync(fence, 0, 0)
        if (status !== gl.TIMEOUT_EXPIRED) break
        await new Promise<void>(resolve => setTimeout(resolve, 10))
      }
    } finally { gl.deleteSync(fence) }
  } finally { fixtures.removeFromParent() }
}

/** Weather and sun elevation can change the shader's shadow-light count.
 * Prepare both counts without changing the live lighting decision. */
export async function warmupShadowVariants(light: { castShadow: boolean },
  prepare: () => Promise<void>): Promise<void> {
  const original = light.castShadow
  try {
    light.castShadow = false; await prepare()
    light.castShadow = true; await prepare()
  } finally { light.castShadow = original }
}
