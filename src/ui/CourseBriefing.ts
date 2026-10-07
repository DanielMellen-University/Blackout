import { formatTime, MAX_BEST_SCORE, medalForScore, nextMedalTargetForScore } from '../systems/ChallengeRun'
import { WEATHER_LABELS } from '../world/WeatherDirector'
import type { CoursePickerItem } from './CoursePicker'

export interface CourseSortieGoal {
  kind: 'first-run' | 'medal' | 'time' | 'explore' | 'record'
  title: string
  detail: string
}

function scoreFor(item: CoursePickerItem): number {
  return Number.isFinite(item.score) ? Math.min(MAX_BEST_SCORE, Math.max(0, Math.floor(item.score!))) : 0
}

/** Short catalog scan lines; the selected briefing retains the full flight log. */
export function courseCardCopy(item: CoursePickerItem): { meta: string; record: string } {
  const meta = [item.favorite ? '★' : '',
    item.difficulty?.toUpperCase(), item.weather ? WEATHER_LABELS[item.weather] : '', item.night ? 'NIGHT' : '']
    .filter(Boolean).join(' · ')
  const score = scoreFor(item)
  const runs = Number.isFinite(item.runs) ? Math.max(0, Math.floor(item.runs!)) : 0
  const record = score > 0
    ? `PB ${score.toLocaleString()} · ${medalForScore(score).toUpperCase()}`
    : runs > 0 ? `${runs.toLocaleString()} RUN${runs === 1 ? '' : 'S'}` : item.freeFlight ? 'NO CHECKPOINT CLOCK' : 'NEW ROUTE'
  return { meta, record }
}

/** One attainable next-run target, derived from existing records without new persistence. */
export function courseSortieGoal(item: CoursePickerItem): CourseSortieGoal {
  if (item.freeFlight) return {
    kind: 'explore', title: 'Explore beyond the runway',
    detail: 'No checkpoint clock. Cycle radar to find a landmark, explore a new biome, then return to an airfield.',
  }
  const score = scoreFor(item)
  const completed = Number.isFinite(item.runs) && item.runs! >= 1
  if (!completed) return {
    kind: 'first-run', title: 'Complete your first circuit',
    detail: 'Pass every gate, then land safely with the gear down. A finished route is the first target.',
  }
  const target = nextMedalTargetForScore(score)
  const technique = item.challenge === 'precision'
    ? 'Aim through gate centers and protect your clean-gate streak.'
    : item.challenge === 'altitude'
      ? 'Plan climbs early so you reach each gate without a last-second pull-up.'
      : item.challenge === 'range'
        ? 'Use smooth turns to keep speed between gates.'
        : 'Line up early and save room for a controlled landing.'
  if (target) return {
    kind: 'medal', title: `${target.medal.toUpperCase()} · ${target.score.toLocaleString()} points`,
    detail: `${(target.score - score).toLocaleString()} above your best. ${technique}`,
  }
  if (item.repeatable === false) return {
    kind: 'explore', title: 'Explore a fresh circuit',
    detail: 'Random worlds change the route. Choose an authored course or Ops for a repeatable time challenge.',
  }
  if (Number.isFinite(item.time) && item.time! > 0) return {
    kind: 'time', title: `Beat your ${formatTime(item.time!)} best time`,
    detail: `Gold is secured. Fly a quicker complete circuit, including a safe landing. ${technique}`,
  }
  if (score < MAX_BEST_SCORE) return {
    kind: 'record', title: `Beat your ${score.toLocaleString()} point record`, detail: technique,
  }
  return { kind: 'explore', title: 'Try a different route',
    detail: 'This score record is at its limit. Try another terrain or weather challenge from the catalog.' }
}
