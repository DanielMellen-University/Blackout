import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { APP_VERSION, PREVIOUS_ROADMAP_CHUNK, RELEASE_NAME, ROADMAP_CHUNK, appReleaseLabel, appVersionLabel } from '../src/core/Version'

describe('release version identity', () => {
  it('keeps public release and roadmap identities explicit', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(ROADMAP_CHUNK).toMatch(/^\d+\.\d+$/)
    expect(PREVIOUS_ROADMAP_CHUNK).toMatch(/^\d+\.\d+$/)
    expect(Number(PREVIOUS_ROADMAP_CHUNK.split('.')[0])).toBeLessThanOrEqual(Number(ROADMAP_CHUNK.split('.')[0]))
    expect(RELEASE_NAME).toBe('Systems expansion')
    expect(appVersionLabel()).toBe(`v${APP_VERSION}`)
    expect(appReleaseLabel()).toBe(`v${APP_VERSION} / ${RELEASE_NAME}`)
  })

  it('keeps the README anchored to the immediately previous roadmap chunk', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    expect(readme).toContain(`Previous roadmap chunk: **${PREVIOUS_ROADMAP_CHUNK}**`)
    expect(readme).toContain(`Roadmap chunk: **${ROADMAP_CHUNK}**`)
  })

  it('does not ship the agent playbook', () => {
    expect(() => readFileSync(new URL('../.agents.md', import.meta.url), 'utf8')).toThrow()
  })
})
