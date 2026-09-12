import { describe, expect, it } from 'vitest'
import { startupFailureMessage } from '../src/core/startupFailure'

describe('startup failure guidance', () => {
  it('distinguishes graphics capability failures', () => {
    expect(startupFailureMessage(new Error('WebGL context unavailable'))).toContain('hardware acceleration')
    expect(startupFailureMessage(new Error('renderer initialization failed'))).toContain('another browser')
  })

  it('keeps world-generation failures actionable', () => {
    expect(startupFailureMessage(new Error('reseed: no dry inland pad'))).toBe(
      'Could not create a world. Reload the page to try again.',
    )
  })

  it('falls back to generic guidance for unknown failures', () => {
    expect(startupFailureMessage(new Error('unexpected failure'))).toBe(
      'Blackout could not start. Reload the page to try again.',
    )
    expect(startupFailureMessage(null)).toContain('Blackout could not start')
  })
})
