import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const archive = resolve('docs/reviews/terrain-closeout-b19')
const temporary: string[] = []
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'blackout-closeout-evidence-'))
  temporary.push(dir)
  for (const stage of ['audit', 'final', 'lod', 'hooks']) symlinkSync(join(archive, stage), join(dir, stage))
  for (const file of ['endurance-selection.json', 'hitch-1337.md']) symlinkSync(join(archive, file), join(dir, file))
  mkdirSync(join(dir, 'endurance'))
  for (const file of readdirSync(join(archive, 'endurance'))) {
    if (file !== '42.json') symlinkSync(join(archive, 'endurance', file), join(dir, 'endurance', file))
  }
  const record = JSON.parse(readFileSync(join(archive, 'endurance/42.json'), 'utf8'))
  return { dir, record }
}

function check(dir: string, record: unknown) {
  writeFileSync(join(dir, 'endurance/42.json'), JSON.stringify(record))
  return spawnSync(process.execPath, ['scripts/summarize-terrain-closeout.mjs', dir, '--final'], { encoding: 'utf8' })
}

describe('terrain close-out evidence acceptance', () => {
  it('accepts all retained flights including the authorized alternative seed', () => {
    const { dir, record } = fixture()
    const result = check(dir, record)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    const summary = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'))
    expect(summary.completeEvidence).toBe(true)
    expect(summary.rows).toHaveLength(21)
    expect(summary.knownOpenPerformanceIssues).toHaveLength(1)
  })

  it('rejects a changed alternative-seed route', () => {
    const { dir, record } = fixture()
    const selection = JSON.parse(readFileSync(join(archive, 'endurance-selection.json'), 'utf8'))
    const seed = selection.seeds.find((value: number) => ![42, 73].includes(value))
    const path = join(dir, `endurance/${seed}.json`)
    const alternate = JSON.parse(readFileSync(path, 'utf8'))
    alternate.route.yaw += 0.001
    rmSync(path)
    writeFileSync(path, JSON.stringify(alternate))
    const result = check(dir, record)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Fallback route changed: yaw')
  })

  it('rejects an unauthorized seed selection', () => {
    const { dir, record } = fixture()
    const path = join(dir, 'endurance-selection.json')
    rmSync(path)
    writeFileSync(path, JSON.stringify({ seeds: [42, 73, 808], reason: 'invalid' }))
    const result = check(dir, record)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Unauthorized endurance seed')
  })

  it.each([
    ['diagnostic', (r: any) => { r.diagnosticOnly = true }, 'Diagnostic flight cannot be accepted'],
    ['short', (r: any) => { r.final.seconds = 599 }, 'Duration endurance/42'],
    ['frame gap', (r: any) => { r.metrics.hitches = [{ seconds: 171.9, gapMs: 100.1 }] }, 'Unexplained frame gap'],
    ['terrain stall', (r: any) => { r.metrics.terrainSlow.push({ seconds: 100, ms: 50.1 }) }, 'Slow terrain update'],
    ['missing coverage', (r: any) => { r.metrics.coverageMisses.push({ seconds: 5 }) }, 'Missing terrain after reset warmup'],
    ['route change', (r: any) => { r.route.x += 1 }, 'AssertionError'],
    ['runtime mismatch', (r: any) => { r.sourceHashes['src/main.ts'] = 'invalid' }, 'Source differs from frozen runtime'],
  ])('rejects %s evidence without writing a successful summary', (_, mutate, message) => {
    const { dir, record } = fixture()
    mutate(record)
    const result = check(dir, record)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(message)
    expect(() => readFileSync(join(dir, 'summary.json'))).toThrow()
  })
})
