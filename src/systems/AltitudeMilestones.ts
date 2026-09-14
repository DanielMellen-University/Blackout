const ALTITUDE_THRESHOLDS_M = [500, 1_500, 3_000, 6_000] as const

export interface AltitudeMilestoneEvent {
  thresholdM: number
  crossedCount: number
}

/** One-shot climb milestones for free flight and high routes. */
export class AltitudeMilestoneTracker {
  private crossedCount = 0

  reset(): void {
    this.crossedCount = 0
  }

  update(altitudeM: number, airborne: boolean): AltitudeMilestoneEvent | null {
    if (!airborne || !Number.isFinite(altitudeM)) return null
    const safeAltitude = Math.max(0, altitudeM)
    let lastThreshold = 0
    while (
      this.crossedCount < ALTITUDE_THRESHOLDS_M.length &&
      safeAltitude >= ALTITUDE_THRESHOLDS_M[this.crossedCount]!
    ) {
      lastThreshold = ALTITUDE_THRESHOLDS_M[this.crossedCount]!
      this.crossedCount += 1
    }
    if (lastThreshold <= 0) return null
    return {
      thresholdM: lastThreshold,
      crossedCount: this.crossedCount,
    }
  }

  get highestThresholdM(): number {
    return this.crossedCount > 0
      ? ALTITUDE_THRESHOLDS_M[this.crossedCount - 1]!
      : 0
  }
}

export function altitudeMilestoneThresholds(): readonly number[] {
  return ALTITUDE_THRESHOLDS_M
}
