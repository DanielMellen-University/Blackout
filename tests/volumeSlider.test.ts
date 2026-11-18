import { describe, expect, it } from 'vitest'
import { syncVolumeSlider } from '../src/ui/VolumeSlider'

function slider() {
  const attributes = new Map<string, string>()
  return {
    value: '',
    attributes,
    setAttribute(name: string, value: string) { attributes.set(name, value) },
  }
}

describe('volume slider sync', () => {
  it('announces the same percent the readout shows', () => {
    const range = slider()
    const output = { textContent: '' as string | null }
    syncVolumeSlider(range, output, 0.35)
    expect(range.value).toBe('35')
    expect(range.attributes.get('aria-valuetext')).toBe('35%')
    expect(output.textContent).toBe('35%')
  })

  it('clamps malformed volumes before updating either control', () => {
    const range = slider()
    const output = { textContent: '' as string | null }
    syncVolumeSlider(range, output, 4)
    expect(range.value).toBe('100')
    expect(range.attributes.get('aria-valuetext')).toBe('100%')
    syncVolumeSlider(range, output, Number.NaN)
    expect(range.value).toBe('100')
    syncVolumeSlider(range, output, -1)
    expect(range.value).toBe('0')
    expect(output.textContent).toBe('0%')
  })

  it('tolerates a missing range or readout', () => {
    const output = { textContent: '' as string | null }
    expect(() => syncVolumeSlider(null, output, 0.5)).not.toThrow()
    expect(output.textContent).toBe('50%')
    const range = slider()
    expect(() => syncVolumeSlider(range, undefined, 0.5)).not.toThrow()
    expect(range.attributes.get('aria-valuetext')).toBe('50%')
  })
})
