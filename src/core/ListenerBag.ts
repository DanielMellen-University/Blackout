/**
 * Own a group of DOM listeners so a runtime can release them as one unit.
 * Adding after disposal is ignored, making teardown safe for late startup
 * failures and repeated page-remount paths.
 */
export class ListenerBag {
  private readonly cleanups: Array<() => void> = []
  private disposed = false

  add(
    target: EventTarget | null | undefined,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (this.disposed || !target) return
    target.addEventListener(type, listener, options)
    this.cleanups.push(() => target.removeEventListener(type, listener, options))
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (let i = this.cleanups.length - 1; i >= 0; i--) this.cleanups[i]!()
    this.cleanups.length = 0
  }

  get size(): number {
    return this.cleanups.length
  }
}
