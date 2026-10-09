import { describe, expect, it } from 'vitest'
import { browsingMissionId, dailyChallengeCountdown, featuredMissionNavigationIndex as move } from '../src/ui/MissionPickerLayout'

describe('mission picker layout', () => {
  it('repairs only ordinary saved legacy selections', () => {
    expect(browsingMissionId('weekly-ops')).toBe('training-orbit')
    expect(browsingMissionId('monthly-ops')).toBe('training-orbit')
    expect(browsingMissionId('daily-ops')).toBe('daily-ops')
    expect(browsingMissionId('random')).toBe('random')
  })

  it('counts down to fixed UTC-5 midnight in winter and summer', () => {
    for (const month of ['01', '07']) {
      expect(dailyChallengeCountdown(Date.parse(`2026-${month}-09T04:59:59Z`))).toBe('00:00:01')
      expect(dailyChallengeCountdown(Date.parse(`2026-${month}-09T05:00:00Z`))).toBe('24:00:00')
      expect(dailyChallengeCountdown(Date.parse(`2026-${month}-09T05:00:01Z`))).toBe('23:59:59')
      expect(dailyChallengeCountdown(Date.parse(`2026-${month}-09T00:00:00Z`))).toBe('05:00:00')
    }
    expect(dailyChallengeCountdown(Number.NaN)).toBe('--:--:--')
  })

  it('navigates the displayed three-card row and two-column grid without horizontal wrapping', () => {
    expect(move('ArrowRight', 2, 3, 5, 2)).toBe(2)
    expect(move('ArrowLeft', 3, 3, 5, 2)).toBe(3)
    expect(move('ArrowDown', 0, 3, 5, 2)).toBe(3)
    expect(move('ArrowDown', 2, 3, 5, 2)).toBe(4)
    expect(move('ArrowUp', 3, 3, 5, 2)).toBe(0)
    expect(move('ArrowUp', 4, 3, 5, 2)).toBe(2)
    expect(move('ArrowDown', 6, 3, 5, 2)).toBe(7)
    expect(move('Home', 7, 3, 5, 2)).toBe(0)
    expect(move('End', 0, 3, 5, 2)).toBe(7)
    expect(move('ArrowDown', 2, 3, 0, 2)).toBe(2)
  })
})
