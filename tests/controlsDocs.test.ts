import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** Letter keys InputManager turns into one-shot flight shortcuts. */
function shortcutLetters(): string[] {
  const source = read('src/core/InputManager.ts')
  const handler = source.slice(source.indexOf('private onKeyDown'), source.indexOf('private shouldPreventBrowserDefault'))
  return [...handler.matchAll(/e\.code === 'Key([A-Z])'\) this\.\w+Queued = true/g)].map(match => match[1]!)
}

describe('controls documentation', () => {
  const letters = shortcutLetters()

  it('finds the shortcut keys in the input handler', () => {
    expect(letters).toEqual(expect.arrayContaining(['C', 'P', 'R', 'N', 'M', 'T', 'V', 'X', 'Y']))
  })

  it('lists every flight shortcut in the README controls', () => {
    const readme = read('README.md')
    const controls = readme.slice(readme.indexOf('Default keyboard controls:'), readme.indexOf('Keyboard mappings, camera'))
    const missing = letters.filter(letter => !new RegExp(`(^|[\\s/;(])${letter}( |$)`, 'm').test(controls))
    expect(missing).toEqual([])
  })

  it('lists every flight shortcut on the in-game Controls page', () => {
    const html = read('index.html')
    const page = html.slice(html.indexOf('id="menu-controls"'), html.indexOf('id="menu-info"'))
    const missing = letters.filter(letter => !page.includes(`<kbd>${letter}</kbd>`))
    expect(missing).toEqual([])
  })
})
