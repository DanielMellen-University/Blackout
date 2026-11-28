import { describe, expect, it } from 'vitest'
import { startupFailureCanRetry, startupFailureMessage } from '../src/core/startupFailure'

describe('startup failure guidance', () => {
  it('distinguishes graphics capability failures', () => {
    expect(startupFailureMessage(new Error('WebGL context unavailable'))).toContain('hardware acceleration')
    expect(startupFailureMessage(new Error('renderer initialization failed'))).toContain('another browser')
  })

  it('keeps world-generation failures actionable', () => {
    expect(startupFailureMessage(new Error('reseed: no dry inland pad'))).toBe(
      'Could not create a world. Press Retry to try again.',
    )
    expect(startupFailureCanRetry(new Error('reseed: no dry inland pad'))).toBe(true)
    expect(startupFailureCanRetry(new Error('WebGL context unavailable'))).toBe(false)
    expect(startupFailureCanRetry(new Error('unexpected failure'))).toBe(false)
  })

  it('falls back to generic guidance for unknown failures', () => {
    expect(startupFailureMessage(new Error('unexpected failure'))).toBe(
      'Blackout could not start. Reload the page to try again.',
    )
    expect(startupFailureMessage(null)).toContain('Blackout could not start')
  })

  it('offers Retry in the message exactly when a retry is allowed', () => {
    const failures: unknown[] = [
      'terrain worker timed out',
      'spawn search exhausted',
      new Error('GPU terrain upload failed'),
      new Error('World build aborted'),
      new TypeError('renderer is undefined'),
      'quota exceeded',
      42,
      undefined,
    ]
    for (const failure of failures) {
      const offersRetry = startupFailureMessage(failure).includes('Press Retry')
      expect(offersRetry, String(failure)).toBe(startupFailureCanRetry(failure))
    }
    expect(startupFailureCanRetry('terrain worker timed out')).toBe(true)
    expect(startupFailureCanRetry(new Error('GPU terrain upload failed'))).toBe(false)
  })
})
