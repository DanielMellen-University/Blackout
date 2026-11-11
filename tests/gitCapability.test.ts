import { describe, expect, it } from 'vitest'
import { unavailableGitReason } from './helpers/gitCapability'

describe('Git evidence capability classification', () => {
  it.each(['ENOENT', 'EACCES', 'EPERM', 'EROFS'])('names the missing capability for %s', code => {
    expect(unavailableGitReason(Object.assign(new Error('denied'), { code })))
      .toBe(`Git archive reads unavailable (${code}); frozen-runtime evidence checks require Git subprocess access.`)
  })

  it.each([undefined, null, {}, new Error('bad revision'), { code: 'ENOBUFS' }, { code: 'EIO' }, { code: 1 }])(
    'does not disguise a genuine command or unexpected failure %#', error => {
      expect(unavailableGitReason(error)).toBeNull()
    },
  )
})
