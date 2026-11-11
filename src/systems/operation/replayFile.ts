import { isEnergyChoice, isRouteChoice, type EnergyChoice, type RouteChoice } from './choices'
import { OPERATION_ID, OPERATION_STAGES, type OperationStageId } from './identity'
import type { OperationTranscript } from './replay'
import type { FlightSample } from './samples'
import { normalizeOperationSeed } from './seed'

export const OPERATION_REPLAY_FORMAT = 'blackout-operation-replay' as const
export const OPERATION_REPLAY_VERSION = 1 as const
/** UTF-8 input/output budget, well above the live flight's 5,400 samples. */
export const OPERATION_REPLAY_MAX_BYTES = 16 * 1024 * 1024
export type ReplayFlightMode = 'model' | 'stick'

export interface OperationReplayClaim {
  stages: Record<OperationStageId, number>
  total: number
}

export interface OperationReplayFile {
  format: typeof OPERATION_REPLAY_FORMAT
  version: typeof OPERATION_REPLAY_VERSION
  operationId: typeof OPERATION_ID
  seed: number
  decisions: { route: RouteChoice; energy: EnergyChoice }
  /** Omitted when the stored transcript does not know who flew it. */
  flightMode?: ReplayFlightMode
  samples: Record<OperationStageId, FlightSample[]>
  claimed: OperationReplayClaim
  integrity: string
}

export type ReplayFileReason =
  | 'invalid-json' | 'duplicate-key' | 'invalid-shape' | 'wrong-format' | 'wrong-version' | 'wrong-operation'
  | 'invalid-seed' | 'invalid-decisions' | 'invalid-flight-mode' | 'missing-stage'
  | 'invalid-sample' | 'non-finite' | 'out-of-order' | 'invalid-claim'
  | 'invalid-integrity' | 'integrity-mismatch' | 'too-deep' | 'too-large'

export interface ReplayFileFailure {
  ok: false
  reason: ReplayFileReason
  path: string
}

export type ReplayFileParse = { ok: true; file: OperationReplayFile } | ReplayFileFailure

export class ReplayFileError extends Error {
  readonly reason: ReplayFileReason
  readonly path: string

  constructor(reason: ReplayFileReason, path: string) {
    super(`${reason} at ${path}`)
    this.reason = reason
    this.path = path
  }
}

function fail(reason: ReplayFileReason, path: string): never {
  throw new ReplayFileError(reason, path)
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('invalid-shape', path)
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail('invalid-shape', `${path}.${key}`)
  }
}

function finite(value: unknown, path: string, reason: ReplayFileReason): number {
  if (typeof value !== 'number') fail(reason, path)
  if (!Number.isFinite(value)) fail('non-finite', path)
  return value
}

const SAMPLE_NUMBERS = ['t', 'x', 'y', 'z', 'speed', 'clearance'] as const

/** Validate before hashing, so malformed data has a useful reason and field path. */
function validateContent(value: unknown): asserts value is Omit<OperationReplayFile, 'integrity'> {
  const file = object(value, '$')
  keys(file, ['format', 'version', 'operationId', 'seed', 'decisions', 'flightMode', 'samples', 'claimed', 'integrity'], '$')
  if (file.format !== OPERATION_REPLAY_FORMAT) fail('wrong-format', '$.format')
  if (file.version !== OPERATION_REPLAY_VERSION) fail('wrong-version', '$.version')
  if (file.operationId !== OPERATION_ID) fail('wrong-operation', '$.operationId')
  const seed = finite(file.seed, '$.seed', 'invalid-seed')
  if (seed !== normalizeOperationSeed(seed)) fail('invalid-seed', '$.seed')
  const decisions = object(file.decisions, '$.decisions')
  keys(decisions, ['route', 'energy'], '$.decisions')
  if (!isRouteChoice(decisions.route)) fail('invalid-decisions', '$.decisions.route')
  if (!isEnergyChoice(decisions.energy)) fail('invalid-decisions', '$.decisions.energy')
  if ('flightMode' in file && file.flightMode !== 'model' && file.flightMode !== 'stick') {
    fail('invalid-flight-mode', '$.flightMode')
  }
  const stages = object(file.samples, '$.samples')
  keys(stages, OPERATION_STAGES, '$.samples')
  // Captured time is global to the run, including across stage boundaries.
  let previousTime = -Infinity
  for (const id of OPERATION_STAGES) {
    const path = `$.samples.${id}`
    const samples = stages[id]
    if (!Array.isArray(samples) || samples.length < 2) fail('missing-stage', path)
    for (let index = 0; index < samples.length; index += 1) {
      const at = `${path}[${index}]`
      const sample = object(samples[index], at)
      keys(sample, [...SAMPLE_NUMBERS, 'airborne', 'fuel', 'nitro'], at)
      for (const key of SAMPLE_NUMBERS) finite(sample[key], `${at}.${key}`, 'invalid-sample')
      if (typeof sample.airborne !== 'boolean') fail('invalid-sample', `${at}.airborne`)
      for (const key of ['t', 'speed'] as const) {
        if ((sample[key] as number) < 0) fail('invalid-sample', `${at}.${key}`)
      }
      for (const [key, max] of [['fuel', 100], ['nitro', 1]] as const) {
        if (!(key in sample)) continue
        const amount = finite(sample[key], `${at}.${key}`, 'invalid-sample')
        if (amount < 0 || amount > max) fail('invalid-sample', `${at}.${key}`)
      }
      if ((sample.t as number) <= previousTime) fail('out-of-order', `${at}.t`)
      previousTime = sample.t as number
    }
  }
  const claimed = object(file.claimed, '$.claimed')
  keys(claimed, ['stages', 'total'], '$.claimed')
  const scores = object(claimed.stages, '$.claimed.stages')
  keys(scores, OPERATION_STAGES, '$.claimed.stages')
  for (const id of OPERATION_STAGES) validateScore(scores[id], `$.claimed.stages.${id}`)
  validateScore(claimed.total, '$.claimed.total')
}

function validateScore(value: unknown, path: string): void {
  if (!Number.isSafeInteger(finite(value, path, 'invalid-claim'))) fail('invalid-claim', path)
}

/** Sorted object keys, array order retained, JSON number spelling, no whitespace. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** FNV-1a 64 over canonical UTF-8. An integrity checksum, not an authenticity proof. */
function integrity(canonicalContent: string): string {
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(canonicalContent)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n)
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`
}

/** Export claims from the recorded result, rather than silently replacing them by a rescore. */
export function serializeOperationReplayFile(
  transcript: OperationTranscript & { flightMode?: ReplayFlightMode },
  claimed: OperationReplayClaim,
): string {
  const content = {
    format: OPERATION_REPLAY_FORMAT,
    version: transcript.version,
    operationId: transcript.id,
    seed: transcript.seed,
    decisions: { route: transcript.route, energy: transcript.energy },
    ...('flightMode' in transcript ? { flightMode: transcript.flightMode } : {}),
    samples: transcript.samples,
    claimed,
  }
  validateContent(content)
  const canonicalContent = canonical(content)
  // The integrity member adds 39 bytes to the object, plus the export newline.
  assertTextBudget(canonicalContent, 40)
  return `${canonical({ ...content, integrity: integrity(canonicalContent) })}\n`
}

/** Walk JSON before parsing objects: JSON.parse would discard earlier duplicate members.
 * Use an explicit stack so nested arrays/objects do not consume the call stack.
 */
function rejectDuplicateKeys(text: string): void {
  type Frame =
    | { kind: 'object'; path: string; keys: Set<string>; state: 'first' | 'key' | 'end' }
    | { kind: 'array'; path: string; index: number; state: 'first' | 'value' | 'end' }
  const stack: Frame[] = []
  let offset = 0
  const invalid = (): never => { throw new SyntaxError('Invalid JSON') }
  const whitespace = () => {
    while (offset < text.length && /[ \t\r\n]/.test(text[offset]!)) offset += 1
  }
  const string = (): string => {
    if (text[offset] !== '"') invalid()
    const start = offset++
    while (offset < text.length) {
      const char = text[offset++]
      if (char === '"') return JSON.parse(text.slice(start, offset)) as string
      if (char === '\\') offset += 1
    }
    return invalid()
  }
  const value = (path: string): void => {
    whitespace()
    const char = text[offset]
    // A replay needs only four container levels. Bound unknown input before
    // retaining its paths or asking JSON.parse to allocate the complete tree.
    if ((char === '{' || char === '[') && stack.length >= 32) fail('too-deep', path)
    if (char === '{') {
      offset += 1
      stack.push({ kind: 'object', path, keys: new Set(), state: 'first' })
    } else if (char === '[') {
      offset += 1
      stack.push({ kind: 'array', path, index: 0, state: 'first' })
    } else if (char === '"') {
      string()
    } else {
      const start = offset
      while (offset < text.length && !/[ \t\r\n,:[\]{}]/.test(text[offset]!)) offset += 1
      // Native parsing validates number/literal syntax, including numeric exponents.
      JSON.parse(text.slice(start, offset))
    }
  }

  value('$')
  while (stack.length) {
    const frame = stack[stack.length - 1]!
    const close = frame.kind === 'object' ? '}' : ']'
    whitespace()
    if ((frame.state === 'first' || frame.state === 'end') && text[offset] === close) {
      offset += 1
      stack.pop()
    } else if (frame.state === 'end') {
      if (text[offset++] !== ',') invalid()
      frame.state = frame.kind === 'object' ? 'key' : 'value'
    } else if (frame.kind === 'object') {
      const key = string()
      const path = `${frame.path}.${key}`
      if (frame.keys.has(key)) fail('duplicate-key', path)
      frame.keys.add(key)
      whitespace()
      if (text[offset++] !== ':') invalid()
      frame.state = 'end'
      value(path)
    } else {
      frame.state = 'end'
      value(`${frame.path}[${frame.index++}]`)
    }
  }
  whitespace()
  if (offset !== text.length) invalid()
}

function assertTextBudget(text: string, extraBytes = 0): void {
  const limit = OPERATION_REPLAY_MAX_BYTES - extraBytes
  if (text.length > limit || new TextEncoder().encode(text).byteLength > limit) fail('too-large', '$')
}

export function parseOperationReplayFile(text: string): ReplayFileParse {
  let value: unknown
  try {
    assertTextBudget(text)
    rejectDuplicateKeys(text)
    value = JSON.parse(text)
  } catch (error) {
    if (error instanceof ReplayFileError) return { ok: false, reason: error.reason, path: error.path }
    return { ok: false, reason: 'invalid-json', path: '$' }
  }
  try {
    validateContent(value)
    const file = value as OperationReplayFile
    if (typeof file.integrity !== 'string' || !/^fnv1a64:[0-9a-f]{16}$/.test(file.integrity)) {
      fail('invalid-integrity', '$.integrity')
    }
    const { integrity: stored, ...content } = file
    if (stored !== integrity(canonical(content))) fail('integrity-mismatch', '$.integrity')
    return { ok: true, file }
  } catch (error) {
    if (!(error instanceof ReplayFileError)) throw error
    return { ok: false, reason: error.reason, path: error.path }
  }
}

/** Convert a validated file to the existing scorer's transcript, without changing its samples. */
export function replayFileTranscript(file: OperationReplayFile): OperationTranscript {
  return {
    version: 1,
    id: file.operationId,
    seed: file.seed,
    route: file.decisions.route,
    energy: file.decisions.energy,
    samples: file.samples,
  }
}
