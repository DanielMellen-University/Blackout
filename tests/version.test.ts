import { describe, expect, it } from 'vitest'
import { APP_VERSION, RELEASE_NAME, ROADMAP_CHUNK, appReleaseLabel, appVersionLabel } from '../src/core/Version'

describe('release version identity', () => {
  it('keeps public release and roadmap identities explicit', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(ROADMAP_CHUNK).toMatch(/^\d+\.\d+$/)
    expect(RELEASE_NAME).toBe('Systems expansion')
    expect(appVersionLabel()).toBe(`v${APP_VERSION}`)
    expect(appReleaseLabel()).toBe(`v${APP_VERSION} / ${RELEASE_NAME}`)
  })
})
