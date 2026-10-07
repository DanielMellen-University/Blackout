import { courseDefinitionForId, courseRunId, courseSessionId, dailyOpsDayKey,
  monthlyOpsMonthKey, resolveCourseDefinition, weeklyOpsWeekKey,
  type CourseDefinition, type CourseId } from '../systems/CourseLibrary'
import type { MissionRouteProfile } from '../systems/Mission'

export interface OpsReplayPin { courseId: CourseId; timestamp: number }
export interface ActiveSortie {
  readonly course: CourseDefinition
  readonly periodKey: string | undefined
  readonly periodLabel: string | undefined
  readonly recordId: string
}

// Leave room for ISO-week arithmetic at the edge of JavaScript's Date range.
const validTimestamp = (value: number): boolean => Number.isFinite(value) && Math.abs(value) <= 8.64e15 - 604_800_000

/** Menu time can advance; a captured sortie never follows it or a later selection. */
export class CourseSession {
  private catalogTimestamp: number
  private replay: OpsReplayPin | null

  constructor(nowMs: number, replay: OpsReplayPin | null = null) {
    this.catalogTimestamp = validTimestamp(nowMs) ? nowMs : Date.UTC(2025, 0, 1)
    this.replay = replay && validTimestamp(replay.timestamp) ? { ...replay } : null
  }

  timestampFor(courseId: CourseId): number {
    return this.replay?.courseId === courseId ? this.replay.timestamp : this.catalogTimestamp
  }

  /** A stale/backwards clock must not silently replace the current challenge. */
  refresh(nowMs: number): boolean {
    if (!validTimestamp(nowMs) || nowMs < this.catalogTimestamp ||
      dailyOpsDayKey(nowMs) === dailyOpsDayKey(this.catalogTimestamp)) return false
    this.catalogTimestamp = nowMs
    return true
  }

  leaveReplay(): boolean {
    const hadReplay = this.replay !== null
    this.replay = null
    return hadReplay
  }

  get replayRecordId(): string | null {
    return this.replay ? courseRunId(courseDefinitionForId(this.replay.courseId), this.replay.timestamp) : null
  }

  capture(courseId: CourseId, worldSeed: number, profile: MissionRouteProfile, seededRandom = false): ActiveSortie {
    const timestamp = this.timestampFor(courseId)
    const course = Object.freeze({ ...resolveCourseDefinition(courseDefinitionForId(courseId), timestamp) })
    const periodKey = course.daily ? dailyOpsDayKey(timestamp)
      : course.weekly ? weeklyOpsWeekKey(timestamp) : course.monthly ? monthlyOpsMonthKey(timestamp) : undefined
    const periodLabel = periodKey ? `${course.daily ? 'DAY' : course.weekly ? 'WEEK' : 'MONTH'} ${periodKey}` : undefined
    return Object.freeze({ course, periodKey, periodLabel,
      recordId: courseSessionId(courseId, worldSeed, profile, periodKey, seededRandom) })
  }
}

/** Only launches apply the next selection; retries always keep the captured sortie. */
export function launchNeedsNewWorld(requested: boolean, selected: CourseId,
  active: ActiveSortie, pendingReplaySeed: number | null): boolean {
  return requested || selected !== active.course.id || pendingReplaySeed !== null
}
