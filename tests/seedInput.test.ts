import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseWorldSeed, WORLD_SEED_INVALID_STATUS } from '../src/core/WorldSeed'
import { setSeedInputInvalid } from '../src/ui/SeedInput'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function input() {
  const attributes = new Map<string, string>()
  return {
    attributes,
    setAttribute(name: string, value: string) { attributes.set(name, value) },
    removeAttribute(name: string) { attributes.delete(name) },
  }
}

describe('custom seed field', () => {
  it('marks and clears the invalid state', () => {
    const field = input()
    setSeedInputInvalid(field, true)
    expect(field.attributes.get('aria-invalid')).toBe('true')
    setSeedInputInvalid(field, false)
    expect(field.attributes.has('aria-invalid')).toBe(false)
    expect(() => setSeedInputInvalid(null, true)).not.toThrow()
  })

  it('describes the input the parser actually accepts', () => {
    // Decimal seeds are valid, so the message must not ask for an integer.
    expect(parseWorldSeed('42.125')).toBe(42.125)
    expect(parseWorldSeed('1.1234567')).toBeNull()
    expect(WORLD_SEED_INVALID_STATUS).not.toMatch(/INTEGER/)
    expect(WORLD_SEED_INVALID_STATUS).toMatch(/6 DECIMALS/)
  })

  it('links the field to its status line and resets the invalid state while typing', () => {
    const html = read('index.html')
    expect(html).toMatch(/id="title-seed-input"[^>]*aria-describedby="title-seed-status"/)
    const main = read('src/main.ts')
    expect(main).toContain('titleSeedStatus.textContent = WORLD_SEED_INVALID_STATUS')
    expect(main).toContain("uiListeners.add(titleSeedInput, 'input', () => setSeedInputInvalid(titleSeedInput, false))")
  })
})
