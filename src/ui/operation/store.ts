import { OPERATION_STORAGE_KEY, type OperationStore } from '../../systems/operation/save'

/** Browser progress store. A thrown storage call fails closed inside the save helpers. */
export function browserOperationStore(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): OperationStore {
  return {
    read: () => {
      try {
        return storage?.getItem(OPERATION_STORAGE_KEY) ?? null
      } catch {
        return null
      }
    },
    write: (text) => {
      storage?.setItem(OPERATION_STORAGE_KEY, text)
    },
  }
}
