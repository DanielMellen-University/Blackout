import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { flyOperation } from '../src/systems/operation/harness'
import {
  parseOperationReplayFile,
  replayFileTranscript,
  serializeOperationReplayFile,
  type OperationReplayFile,
} from '../src/systems/operation/replayFile'

const text = readFileSync(new URL('../docs/reviews/operation-11.040/seed-42-valley-commit.replay.json', import.meta.url), 'utf8')
const fixture = JSON.parse(text) as OperationReplayFile

function change(mutate: (file: OperationReplayFile) => void): string {
  const file = structuredClone(fixture)
  mutate(file)
  return JSON.stringify(file)
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reverseKeys(entry)]))
  }
  return value
}

describe('operation replay file', () => {
  it('reproduces the checked-in file byte for byte from the seed-42 model harness', () => {
    const flown = flyOperation(42, 'valley', 'commit')
    expect(flown.passed).toBe(true)
    expect(serializeOperationReplayFile({ ...flown.transcript!, flightMode: 'model' }, {
      stages: {
        ingress: flown.attempt.stages.ingress!.score,
        transit: flown.attempt.stages.transit!.score,
        egress: flown.attempt.stages.egress!.score,
      },
      total: flown.score,
    })).toBe(text)
    expect(fixture.integrity).toBe('fnv1a64:f432b623b208d3f5')
  })

  it('imports exact numbers and optional fuel and nitro without rounding', () => {
    const parsed = parseOperationReplayFile(text)
    expect(parsed).toEqual({ ok: true, file: fixture })
    expect(fixture.samples.egress[0]!.fuel).toBeTypeOf('number')
    expect(fixture.samples.egress[0]!.nitro).toBeTypeOf('number')
    expect(serializeOperationReplayFile({ ...replayFileTranscript(fixture), flightMode: 'model' }, fixture.claimed)).toBe(text)
  })

  it('canonicalizes every object, ignoring key order and whitespace while retaining arrays', () => {
    const reordered = JSON.stringify(reverseKeys(fixture), null, 2)
    const parsed = parseOperationReplayFile(reordered)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(serializeOperationReplayFile({ ...replayFileTranscript(parsed.file), flightMode: parsed.file.flightMode }, parsed.file.claimed)).toBe(text)
  })

  it.each([
    ['root', text.replace('{', '{"seed":0,'), '$.seed'],
    ['nested', text.replace('"total":', '"total":99999,"total":'), '$.claimed.total'],
    ['sample', text.replace('"speed":', '"speed":0,"speed":'), '$.samples.egress[0].speed'],
    ['escape-equivalent', text.replace('"total":', String.raw`"\u0074otal":99999,"total":`), '$.claimed.total'],
    ['identical values', text.replace('{', '{"seed":42,'), '$.seed'],
    ['nested arrays', '{"extra":[[],[{"key":1,"key":2}]]}', '$.extra[1][0].key'],
    ['escaped quotes and backslashes', String.raw`{"a\"\\":1,"a\u0022\u005c":2}`, '$.a"\\'],
    ['surrogate escapes', String.raw`{"😀":1,"\ud83d\ude00":2}`, '$.😀'],
  ])('rejects duplicate keys: %s', (_name, broken, path) => {
    expect(parseOperationReplayFile(broken)).toEqual({ ok: false, reason: 'duplicate-key', path })
  })

  it('accepts escaped keys and values with JSON whitespace and unchanged integrity', () => {
    const escaped = JSON.stringify(fixture, null, '\t')
      .replace('"total"', String.raw`"\u0074otal"`)
      .replace('"valley"', String.raw`"\u0076alley"`)
    expect(parseOperationReplayFile(` \r\n${escaped}\t\r\n`)).toEqual({ ok: true, file: fixture })
  })

  it('leaves strings, arrays and separate objects to the existing shape checks', () => {
    const extra = [[], [null, true, false, -1.25e30], { key: '"key":0, { [ ] } \\ "' }, { key: 'same key in another object' }]
    expect(parseOperationReplayFile(JSON.stringify({ ...fixture, extra })))
      .toEqual({ ok: false, reason: 'invalid-shape', path: '$.extra' })
  })

  it('bounds JSON nesting before retaining a deep stack of field paths', () => {
    const deep = '['.repeat(1000) + '0' + ']'.repeat(1000)
    expect(parseOperationReplayFile(deep)).toEqual({
      ok: false, reason: 'too-deep', path: '$' + '[0]'.repeat(32),
    })
    const edge = '['.repeat(32) + '0' + ']'.repeat(32)
    expect(parseOperationReplayFile(edge)).toEqual({ ok: false, reason: 'invalid-shape', path: '$' })
    expect(parseOperationReplayFile(JSON.stringify({ extra: '['.repeat(1000) })))
      .toEqual({ ok: false, reason: 'invalid-shape', path: '$.extra' })
  })

  it.each([
    ['ASCII', ' '.repeat(16 * 1024 * 1024 + 1)],
    ['UTF-8', '"' + 'é'.repeat(8 * 1024 * 1024) + '"'],
  ])('rejects oversized %s input before JSON scanning', (_name, oversized) => {
    expect(parseOperationReplayFile(oversized)).toEqual({ ok: false, reason: 'too-large', path: '$' })
  })

  it('does not export a file larger than the import byte budget', () => {
    const transcript = replayFileTranscript(structuredClone(fixture))
    let t = 0
    for (const id of ['ingress', 'transit', 'egress'] as const) {
      transcript.samples[id] = Array.from({ length: 60_000 }, () => ({
        ...fixture.samples[id][0]!, t: t++, x: 1.234567890123456e100,
      }))
    }
    expect(() => serializeOperationReplayFile(transcript, fixture.claimed)).toThrow('too-large at $')
  })

  it('hashes numeric values independently of integer, decimal and exponent spelling', () => {
    const alternate = text.replace('"seed":42', '"seed":4.2e1')
      .replace('"version":1', '"version":1.0')
      .replace('"total":61472', '"total":614720e-1')
    expect(parseOperationReplayFile(alternate)).toEqual({ ok: true, file: fixture })
    const transcript = replayFileTranscript(structuredClone(fixture))
    transcript.samples.ingress[0]!.t = -0
    transcript.samples.ingress[0]!.speed = 0
    transcript.samples.ingress[0]!.fuel = 0
    transcript.samples.ingress[0]!.nitro = 1
    const zeroes = serializeOperationReplayFile(transcript, fixture.claimed)
    expect(parseOperationReplayFile(zeroes.replace('"speed":0', '"speed":-0.0'))).toMatchObject({ ok: true })
    expect(parseOperationReplayFile(zeroes.replace('"fuel":0', '"fuel":0e10'))).toMatchObject({ ok: true })
  })

  it.each([
    ['fuel', 0], ['fuel', 100], ['nitro', 0], ['nitro', 1], ['speed', 0], ['t', 0],
  ] as const)('round-trips the valid %s boundary %s', (key, value) => {
    const transcript = replayFileTranscript(structuredClone(fixture))
    transcript.samples.ingress[0]![key] = value
    const parsed = parseOperationReplayFile(serializeOperationReplayFile(transcript, fixture.claimed))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.file.samples.ingress[0]![key]).toBe(value)
  })

  it.each([[], null, {}, [null]])('rejects empty or malformed stage containers %#', samples => {
    expect(parseOperationReplayFile(change(file => { file.samples.ingress = samples as never })))
      .toEqual({ ok: false, reason: 'missing-stage', path: '$.samples.ingress' })
  })

  it('rejects equal time at the exact stage boundary', () => {
    expect(parseOperationReplayFile(change(file => { file.samples.transit[0]!.t = file.samples.ingress.at(-1)!.t })))
      .toEqual({ ok: false, reason: 'out-of-order', path: '$.samples.transit[0].t' })
  })

  it.each([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])('round-trips a safe integer claim %s', total => {
    const claimed = { ...fixture.claimed, total }
    expect(parseOperationReplayFile(serializeOperationReplayFile(replayFileTranscript(fixture), claimed)))
      .toMatchObject({ ok: true, file: { claimed: { total } } })
  })

  it.each([Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1])('rejects unsafe integer claims %s', total => {
    expect(() => serializeOperationReplayFile(replayFileTranscript(fixture), { ...fixture.claimed, total }))
      .toThrow('invalid-claim at $.claimed.total')
  })

  it('preserves absent telemetry and unknown mode rather than inventing values', () => {
    const transcript = replayFileTranscript(structuredClone(fixture))
    for (const samples of Object.values(transcript.samples)) {
      for (const sample of samples) {
        delete sample.fuel
        delete sample.nitro
      }
    }
    const parsed = parseOperationReplayFile(serializeOperationReplayFile(transcript, fixture.claimed))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.file).not.toHaveProperty('flightMode')
    expect(parsed.file.samples.ingress[0]).not.toHaveProperty('fuel')
    expect(parsed.file.samples.egress[0]).not.toHaveProperty('nitro')
  })

  it.each(['model', 'stick'] as const)('preserves known %s flight mode', flightMode => {
    const parsed = parseOperationReplayFile(serializeOperationReplayFile({ ...replayFileTranscript(fixture), flightMode }, fixture.claimed))
    expect(parsed).toMatchObject({ ok: true, file: { flightMode } })
  })

  it.each(['', '{', text.slice(0, -50), 'NaN', '\uFEFF' + text, text + '{}', text + 'garbage', text + '\0'])('rejects truncated or invalid JSON %#', broken => {
    expect(parseOperationReplayFile(broken)).toEqual({ ok: false, reason: 'invalid-json', path: '$' })
  })

  it.each(['null', '[]', '42', 'true', 'false', '"replay"'])('rejects non-object JSON %s', broken => {
    expect(parseOperationReplayFile(broken)).toEqual({ ok: false, reason: 'invalid-shape', path: '$' })
  })

  it.each([
    ['format', 'other', 'wrong-format'],
    ['version', 2, 'wrong-version'],
    ['operationId', 'other', 'wrong-operation'],
    ['seed', 0, 'invalid-seed'],
    ['seed', -42, 'invalid-seed'],
    ['seed', 1.5, 'invalid-seed'],
    ['seed', 1_000_000_001, 'invalid-seed'],
    ['flightMode', 'autopilot', 'invalid-flight-mode'],
  ])('rejects %s=%s with a specific reason', (key, value, reason) => {
    const broken = { ...fixture, [key]: value }
    expect(parseOperationReplayFile(JSON.stringify(broken))).toEqual({ ok: false, reason, path: `$.${key}` })
  })

  it.each(['route', 'energy'] as const)('points to the invalid %s decision', key => {
    expect(parseOperationReplayFile(change(file => { file.decisions[key] = 'coast' as never })))
      .toEqual({ ok: false, reason: 'invalid-decisions', path: `$.decisions.${key}` })
  })

  it.each(['ingress', 'transit', 'egress'] as const)('requires at least two samples in %s', id => {
    expect(parseOperationReplayFile(change(file => { file.samples[id] = file.samples[id].slice(0, 1) })))
      .toEqual({ ok: false, reason: 'missing-stage', path: `$.samples.${id}` })
  })

  it('rejects missing and unexpected stages', () => {
    expect(parseOperationReplayFile(change(file => { delete (file.samples as Partial<typeof file.samples>).transit })))
      .toMatchObject({ ok: false, reason: 'missing-stage', path: '$.samples.transit' })
    expect(parseOperationReplayFile(change(file => { Object.assign(file.samples, { landing: [] }) })))
      .toMatchObject({ ok: false, reason: 'invalid-shape', path: '$.samples.landing' })
  })

  it.each(['t', 'x', 'y', 'z', 'speed', 'clearance', 'fuel', 'nitro'] as const)('rejects non-finite sample %s on export and import', key => {
    const transcript = replayFileTranscript(structuredClone(fixture))
    transcript.samples.ingress[0]![key] = Infinity
    expect(() => serializeOperationReplayFile(transcript, fixture.claimed)).toThrow(`non-finite at $.samples.ingress[0].${key}`)
    const broken = text.replace(new RegExp(`"${key}":[^,}]+`), `"${key}":1e400`)
    expect(parseOperationReplayFile(broken)).toEqual({ ok: false, reason: 'non-finite', path: `$.samples.egress[0].${key}` })
  })

  it.each([
    ['airborne', 'yes'], ['airborne', null], ['speed', -1], ['t', -1],
    ['fuel', -0.001], ['fuel', 100.001], ['fuel', null], ['nitro', -Number.MIN_VALUE], ['nitro', 1.01], ['nitro', null],
  ])('rejects invalid sample %s=%s', (key, value) => {
    const broken = change(file => { Object.assign(file.samples.ingress[0]!, { [key]: value }) })
    expect(parseOperationReplayFile(broken)).toEqual({ ok: false, reason: 'invalid-sample', path: `$.samples.ingress[0].${key}` })
  })

  it('rejects missing numeric fields and unknown sample fields', () => {
    expect(parseOperationReplayFile(change(file => { delete (file.samples.ingress[0]! as Partial<typeof file.samples.ingress[0]>).speed })))
      .toMatchObject({ ok: false, reason: 'invalid-sample', path: '$.samples.ingress[0].speed' })
    expect(parseOperationReplayFile(change(file => { Object.assign(file.samples.ingress[0]!, { command: {} }) })))
      .toMatchObject({ ok: false, reason: 'invalid-shape', path: '$.samples.ingress[0].command' })
  })

  it.each([0, -0.001])('rejects equal or reversed time within a stage (%s)', offset => {
    expect(parseOperationReplayFile(change(file => { file.samples.ingress[1]!.t = file.samples.ingress[0]!.t + offset })))
      .toEqual({ ok: false, reason: 'out-of-order', path: '$.samples.ingress[1].t' })
  })

  it('rejects stage clocks that reset across a boundary', () => {
    expect(parseOperationReplayFile(change(file => { file.samples.transit[0]!.t = 0 })))
      .toEqual({ ok: false, reason: 'out-of-order', path: '$.samples.transit[0].t' })
  })

  it('rejects malformed or missing score claims', () => {
    expect(parseOperationReplayFile(change(file => { file.claimed.total = 1.5 })))
      .toMatchObject({ ok: false, reason: 'invalid-claim', path: '$.claimed.total' })
    expect(parseOperationReplayFile(change(file => { delete (file.claimed.stages as Partial<typeof file.claimed.stages>).transit })))
      .toMatchObject({ ok: false, reason: 'invalid-claim', path: '$.claimed.stages.transit' })
    expect(() => serializeOperationReplayFile(replayFileTranscript(fixture), { ...fixture.claimed, total: NaN }))
      .toThrow('non-finite at $.claimed.total')
  })

  it('rejects unknown top-level fields instead of leaving them outside integrity', () => {
    expect(parseOperationReplayFile(JSON.stringify({ ...fixture, extra: true })))
      .toEqual({ ok: false, reason: 'invalid-shape', path: '$.extra' })
  })

  it.each(['', 'fnv1a64:abcd', 'sha256:1234', null, fixture.integrity + '\n', fixture.integrity + '\r\n', fixture.integrity.toUpperCase(), 'fnv1a64:00000000000000000'])('rejects malformed integrity %s', integrity => {
    expect(parseOperationReplayFile(JSON.stringify({ ...fixture, integrity })))
      .toEqual({ ok: false, reason: 'invalid-integrity', path: '$.integrity' })
  })

  it.each([
    (file: OperationReplayFile) => { file.samples.egress[10]!.speed += 1 },
    (file: OperationReplayFile) => { file.claimed.stages.transit += 1 },
    (file: OperationReplayFile) => { file.claimed.total += 1 },
    (file: OperationReplayFile) => { file.seed += 1 },
    (file: OperationReplayFile) => { file.decisions.energy = 'conserve' },
    (file: OperationReplayFile) => { file.flightMode = 'stick' },
    (file: OperationReplayFile) => { file.samples.egress.pop() },
  ])('detects changed content or a shortened trace without an updated hash %#', mutate => {
    expect(parseOperationReplayFile(change(mutate)))
      .toEqual({ ok: false, reason: 'integrity-mismatch', path: '$.integrity' })
  })
})
