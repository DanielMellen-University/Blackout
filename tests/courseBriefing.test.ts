import { describe, expect, it } from 'vitest'
import { MAX_BEST_SCORE } from '../src/systems/ChallengeRun'
import { courseCardCopy, courseSortieGoal } from '../src/ui/CourseBriefing'
import type { CoursePickerItem } from '../src/ui/CoursePicker'

const item: CoursePickerItem = { id: 'route', label: 'A route', detail: '', meta: '', stats: '' }

describe('course briefing goals', () => {
  it('prioritizes a complete circuit before a record chase', () => {
    expect(courseSortieGoal(item)).toMatchObject({ kind: 'first-run' })
    expect(courseSortieGoal({ ...item, runs: Number.NaN, score: 88_000 })).toMatchObject({ kind: 'first-run' })
    expect(courseSortieGoal({ ...item, runs: 1, score: 0 })).toMatchObject({ kind: 'medal', title: 'BRONZE · 64,000 points' })
  })

  it.each([
    [63_999, 'BRONZE', '1 above'], [64_000, 'SILVER', '12,000 above'],
    [75_999, 'SILVER', '1 above'], [76_000, 'GOLD', '12,000 above'], [87_999, 'GOLD', '1 above'],
  ])('targets the next medal after %s points', (score, medal, gap) => {
    const goal = courseSortieGoal({ ...item, runs: 2, score })
    expect(goal.kind).toBe('medal')
    expect(goal.title).toContain(medal)
    expect(goal.detail).toContain(gap)
  })

  it('explains how to improve the course focus instead of just naming a score', () => {
    expect(courseSortieGoal({ ...item, runs: 2, challenge: 'precision' }).detail).toContain('gate centers')
    expect(courseSortieGoal({ ...item, runs: 2, challenge: 'altitude' }).detail).toContain('Plan climbs early')
    expect(courseSortieGoal({ ...item, runs: 2, challenge: 'range' }).detail).toContain('smooth turns')
    expect(courseSortieGoal({ ...item, runs: 2, challenge: 'approach' }).detail).toContain('controlled landing')
  })

  it('chases complete-circuit time after gold, not an impossible score cap', () => {
    expect(courseSortieGoal({ ...item, runs: 2, score: 88_000, time: 42.5 })).toMatchObject({
      kind: 'time', title: 'Beat your 0:42.50 best time',
    })
    expect(courseSortieGoal({ ...item, runs: 2, score: 88_000, time: Number.NaN }).kind).toBe('record')
    expect(courseSortieGoal({ ...item, runs: 2, score: MAX_BEST_SCORE, time: 0 }).kind).toBe('explore')
  })

  it('never gives free exploration a checkpoint, medal, or circuit-time goal', () => {
    const goal = courseSortieGoal({ ...item, freeFlight: true, runs: 5, score: 76_000, time: 42 })
    expect(goal.kind).toBe('explore')
    expect(goal.detail).toContain('No checkpoint clock')
    expect(courseSortieGoal({ ...item, category: 'explore' }).kind).toBe('first-run')
  })

  it('does not compare circuit times across changing random worlds', () => {
    const goal = courseSortieGoal({ ...item, runs: 2, score: 88_000, time: 42, repeatable: false })
    expect(goal).toMatchObject({ kind: 'explore', title: 'Explore a fresh circuit' })
    expect(goal.detail).toContain('repeatable time challenge')
    expect(courseSortieGoal({ ...item, runs: 2, score: 88_000, time: 42, repeatable: true }).kind).toBe('time')
  })

  it('keeps browsing copy short and repairs malformed telemetry', () => {
    expect(courseCardCopy({ ...item, favorite: true, difficulty: 'technical', weather: 'storm', night: true, score: 76_000 }))
      .toEqual({ meta: 'TECHNICAL · THUNDERSTORM · NIGHT', record: 'PB 76,000 · SILVER' })
    expect(courseCardCopy({ ...item, score: Number.NaN, runs: Number.POSITIVE_INFINITY }).record).toBe('NEW ROUTE')
    expect(courseCardCopy({ ...item, runs: 1 }).record).toBe('1 RUN')
    expect(courseCardCopy({ ...item, runs: 2, freeFlight: true }).record).toBe('2 RUNS')
    expect(courseCardCopy({ ...item, freeFlight: true }).record).toBe('NO CHECKPOINT CLOCK')
    expect(courseSortieGoal({ ...item, runs: 1, score: Number.POSITIVE_INFINITY }).title).toContain('64,000')
  })
})
