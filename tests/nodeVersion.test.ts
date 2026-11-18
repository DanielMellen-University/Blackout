import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nodeVersionNotice } from './helpers/nodeVersion'

describe('Node version notice', () => {
  it('stays quiet on the pinned major', () => {
    expect(nodeVersionNotice('v22.23.5', '22\n')).toBeNull()
    expect(nodeVersionNotice('22.1.0', 'v22')).toBeNull()
    expect(nodeVersionNotice('v22.0.0', '22.11.0')).toBeNull()
  })

  it('names both majors when they differ', () => {
    const notice = nodeVersionNotice('v24.22.1', '22')
    expect(notice).toContain('Node 24')
    expect(notice).toContain('Node 22')
    expect(notice).toContain('hydrology')
  })

  it('stays quiet when either version cannot be read', () => {
    expect(nodeVersionNotice('v24.1.0', '')).toBeNull()
    expect(nodeVersionNotice('v24.1.0', 'lts/*')).toBeNull()
    expect(nodeVersionNotice('nightly', '22')).toBeNull()
  })

  it('is wired into the vitest config', () => {
    const config = readFileSync(new URL('../vitest.config.ts', import.meta.url), 'utf8')
    expect(config).toContain("globalSetup: ['tests/setup/nodeVersion.ts']")
  })
})
