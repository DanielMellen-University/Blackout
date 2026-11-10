import { operationDevRequested } from '../../systems/operation/devFlag'
import type { CoursePickerItem } from '../CoursePicker'

/**
 * Transient flight-plan launch. It is not a catalog course and not a featured card.
 * The card is absent unless `?dev=operation` is set.
 */
export function operationLaunchItem(activate: () => void, search = ''): CoursePickerItem | null {
  if (!operationDevRequested(search)) return null
  return {
    id: 'ridge-relay',
    label: 'Ridge relay',
    detail: 'Three stages in the air, from the cockpit',
    meta: 'Stick or model, then valley or ridge',
    stats: '',
    activate,
  }
}
