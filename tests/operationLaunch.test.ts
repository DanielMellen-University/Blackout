import { describe, expect, it, vi } from 'vitest'
import { COURSE_LIBRARY } from '../src/systems/CourseLibrary'
import { operationLaunchItem } from '../src/ui/operation/launch'
import { FEATURED_MISSION_IDS } from '../src/ui/MissionPickerLayout'
import { browserOperationStore } from '../src/ui/operation/store'
import { OPERATION_STORAGE_KEY } from '../src/systems/operation/save'

describe('operation launch', () => {
  it('stays off the flight plan unless the dev flag is set', () => {
    expect(operationLaunchItem(vi.fn())).toBeNull()
    expect(operationLaunchItem(vi.fn(), '?dev=perfect-line')).toBeNull()
    expect(operationLaunchItem(vi.fn(), 'dev=other')).toBeNull()
  })

  it('launches ridge relay from the operation flag without joining the catalog', () => {
    const activate = vi.fn()
    const item = operationLaunchItem(activate, '?dev=operation')
    expect(item?.id).toBe('ridge-relay')
    expect(item?.label).toBe('Ridge relay')
    expect(item?.detail).toContain('air')
    item?.activate?.()
    expect(activate).toHaveBeenCalledOnce()
    expect(COURSE_LIBRARY).toHaveLength(82)
    expect(COURSE_LIBRARY.some(course => course.id === 'ridge-relay')).toBe(false)
    expect([...FEATURED_MISSION_IDS]).toEqual(['free-flight', 'training-orbit', 'daily-ops'])
  })

  it('reads and writes the operation store', () => {
    const values = new Map<string, string>()
    const store = browserOperationStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
    })
    expect(store.read()).toBeNull()
    store.write('{"version":1}')
    expect(values.get(OPERATION_STORAGE_KEY)).toBe('{"version":1}')
    expect(store.read()).toBe('{"version":1}')
  })

  it('fails closed when storage throws', () => {
    const store = browserOperationStore({
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(store.read()).toBeNull()
    expect(() => store.write('x')).toThrow()
  })
})
