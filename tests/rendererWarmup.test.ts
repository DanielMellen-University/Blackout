import { Group, Mesh, PerspectiveCamera, Scene } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { warmupMaterials, warmupShadowVariants } from '../src/core/RendererWarmup'

afterEach(() => vi.useRealTimers())
it('warms bindings in the actual scene and yields while waiting for GPU completion', async () => {
  vi.useFakeTimers()
  const scene = new Scene(), fixtures = new Group(), mesh = new Mesh()
  fixtures.add(mesh)
  const fence = {}, gl = { isContextLost: () => false, fenceSync: vi.fn(() => fence), flush: vi.fn(),
    clientWaitSync: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(1),
    deleteSync: vi.fn(), TIMEOUT_EXPIRED: 0, SYNC_GPU_COMMANDS_COMPLETE: 3 }
  const compileAsync = vi.fn(async () => fixtures)
  const render = vi.fn(() => {
    expect(fixtures.parent).toBe(scene)
    expect(mesh.frustumCulled).toBe(false)
  })
  const pending = warmupMaterials({ compileAsync, render,
    getContext: () => gl as unknown as WebGL2RenderingContext }, fixtures, new PerspectiveCamera(), scene)
  await vi.runAllTimersAsync(); await pending
  expect(compileAsync).toHaveBeenCalledOnce(); expect(render).toHaveBeenCalledOnce()
  expect(gl.clientWaitSync).toHaveBeenCalledTimes(3)
  expect(gl.deleteSync).toHaveBeenCalledExactlyOnceWith(fence)
  expect(fixtures.parent).toBeNull()
})
it('removes temporary fixtures if rendering fails without changing resident objects', async () => {
  const scene = new Scene(), resident = new Group(), fixtures = new Group()
  scene.add(resident)
  const renderer = { compileAsync: vi.fn(async () => fixtures), render: () => { throw new Error('context') },
    getContext: vi.fn() }
  await expect(warmupMaterials(renderer, fixtures, new PerspectiveCamera(), scene)).rejects.toThrow('context')
  expect(scene.children).toEqual([resident])
  expect(renderer.getContext).not.toHaveBeenCalled()
})
it('releases fixtures immediately when the context has already been lost', async () => {
  const scene = new Scene(), fixtures = new Group(), gl = { isContextLost: () => true, fenceSync: vi.fn() }
  await warmupMaterials({ compileAsync: async () => fixtures, render: vi.fn(),
    getContext: () => gl as unknown as WebGL2RenderingContext }, fixtures, new PerspectiveCamera(), scene)
  expect(fixtures.parent).toBeNull(); expect(gl.fenceSync).not.toHaveBeenCalled()
})

it('prepares both shadow-light counts and restores live lighting even on failure', async () => {
  const light = { castShadow: false }, states: boolean[] = []
  await warmupShadowVariants(light, async () => { states.push(light.castShadow) })
  expect(states).toEqual([false, true]); expect(light.castShadow).toBe(false)
  light.castShadow = true
  await expect(warmupShadowVariants(light, async () => { throw new Error('compile') })).rejects.toThrow('compile')
  expect(light.castShadow).toBe(true)
})
