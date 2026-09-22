import { Quaternion, Scene, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  MACH_CONE_MAX_SPEED_MPS,
  MACH_CONE_MIN_SPEED_MPS,
  MachConeFx,
  machConeActive,
  machConeIntensity,
} from '../src/systems/MachConeFx'

describe('mach cone effect', () => {
  it('ramps only through the finite supersonic envelope', () => {
    expect(machConeIntensity(Number.NaN)).toBe(0)
    expect(machConeIntensity(MACH_CONE_MIN_SPEED_MPS - 1)).toBe(0)
    expect(machConeIntensity(MACH_CONE_MAX_SPEED_MPS)).toBe(1)
    expect(machConeIntensity(MACH_CONE_MAX_SPEED_MPS * 3)).toBe(1)
  })

  it('requires airborne external supersonic flight', () => {
    expect(machConeActive(380, false, true)).toBe(true)
    expect(machConeActive(380, true, true)).toBe(false)
    expect(machConeActive(380, false, false)).toBe(false)
    expect(machConeActive(120, false, true)).toBe(false)
  })

  it('keeps one pooled cone across quality, motion, and disposal', () => {
    const scene = new Scene()
    const fx = new MachConeFx(scene)
    const position = new Vector3(2, 300, -5)
    const orientation = new Quaternion()
    fx.setRenderQuality('high')
    fx.update(position, orientation, 390, false, true)
    expect(fx.isActive).toBe(true)
    expect(fx.root.visible).toBe(true)
    expect(scene.children).toHaveLength(1)
    fx.setReducedMotion(true)
    expect(fx.isActive).toBe(false)
    expect(fx.root.visible).toBe(false)
    fx.setRenderQuality('low')
    fx.update(position, orientation, 390, false, true)
    expect(fx.isActive).toBe(false)
    fx.dispose()
    expect(scene.children).toHaveLength(0)
  })
})
