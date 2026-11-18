import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Selectors of every rule nested in a prefers-reduced-motion media block. */
function mediaSelectors(css: string): string[] {
  const selectors: string[] = []
  const marker = '@media (prefers-reduced-motion: reduce)'
  for (let start = css.indexOf(marker); start >= 0; start = css.indexOf(marker, start + marker.length)) {
    let index = css.indexOf('{', start) + 1
    let depth = 1
    let ruleStart = index
    for (; index < css.length && depth > 0; index++) {
      const char = css[index]
      if (char === '{') {
        if (depth === 1) selectors.push(...splitSelectors(css.slice(ruleStart, index)))
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 1) ruleStart = index + 1
      }
    }
  }
  return selectors
}

/** Split a selector list on top-level commas so :is() groups stay intact. */
function splitSelectors(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of list) {
    if (char === '(') depth++
    else if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.map(part => part.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** Selectors scoped under the in-game reduced-motion class, with :is() lists expanded. */
function classSelectors(css: string): Set<string> {
  const found = new Set<string>()
  const rule = /([^{}]+)\{/g
  for (let match = rule.exec(css); match; match = rule.exec(css)) {
    for (const selector of splitSelectors(match[1]!)) {
      if (!selector.startsWith('.reduced-motion ')) continue
      const rest = selector.slice('.reduced-motion '.length)
      const is = /^:is\((.*)\)$/.exec(rest)
      for (const inner of is ? splitSelectors(is[1]!) : [rest]) found.add(inner)
    }
  }
  return found
}

describe('reduced motion styles', () => {
  const sources: Array<[string, () => string]> = [
    ['src/style.css', () => read('src/style.css')],
    ['src/ui/settingsDeck.css', () => read('src/ui/settingsDeck.css')],
    ['the index.html startup styles', () => read('index.html').split('<style>')[1]!.split('</style>')[0]!],
  ]
  for (const [label, source] of sources) {
    it(`mirrors every system reduced-motion rule for the in-game setting in ${label}`, () => {
      const css = stripComments(source())
      const media = mediaSelectors(css)
      expect(media.length).toBeGreaterThan(0)
      const mirrored = classSelectors(css)
      expect(media.filter(selector => !mirrored.has(selector))).toEqual([])
    })
  }
})
