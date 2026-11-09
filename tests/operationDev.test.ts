import { describe, expect, it } from 'vitest'
import { COURSE_LIBRARY } from '../src/systems/CourseLibrary'
import { operationDevRequested } from '../src/systems/operation/devFlag'
import { FEATURED_MISSION_IDS } from '../src/ui/MissionPickerLayout'

describe('operation launch flag', () => {
  it('stays off unless the dev flag is set', () => {
    expect(operationDevRequested('')).toBe(false)
    expect(operationDevRequested('?dev=perfect-line')).toBe(false)
    expect(operationDevRequested('dev=operation')).toBe(true)
    expect(operationDevRequested('?dev=operation&x=1')).toBe(true)
  })
})
