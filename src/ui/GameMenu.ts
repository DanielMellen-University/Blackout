export type MenuMode = 'title' | 'pause'
type MenuView = 'root' | 'controls' | 'info'

/**
 * Title settings + in-flight pause menu.
 */
export class GameMenu {
  private mode: MenuMode = 'title'
  private view: MenuView = 'root'
  private readonly root: HTMLElement
  private readonly panelRoot: HTMLElement
  private readonly panelControls: HTMLElement
  private readonly panelInfo: HTMLElement
  private readonly heading: HTMLElement
  private readonly btnResume: HTMLElement
  private readonly btnQuit: HTMLElement
  private readonly btnRetry: HTMLElement
  private readonly btnNewWorld: HTMLElement
  private readonly btnFs: HTMLElement
  private readonly fsState: HTMLElement
  private readonly btnClose: HTMLElement
  private returnFocus: HTMLElement | null = null
  private disposed = false
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || !this.open || event.key !== 'Tab') return
    const focusable = this.activeFocusable()
    if (focusable.length === 0) return

    const active = document.activeElement
    const index = active instanceof HTMLElement ? focusable.indexOf(active) : -1
    if (event.shiftKey && index <= 0) {
      event.preventDefault()
      focusable[focusable.length - 1]!.focus({ preventScroll: true })
    } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
      event.preventDefault()
      focusable[0]!.focus({ preventScroll: true })
    }
  }

  constructor(root: HTMLElement) {
    this.root = root
    this.panelRoot = must(root, '#menu-root')
    this.panelControls = must(root, '#menu-controls')
    this.panelInfo = must(root, '#menu-info')
    this.heading = must(root, '#menu-heading')
    this.btnResume = must(root, '#menu-resume')
    this.btnQuit = must(root, '#menu-quit')
    this.btnRetry = must(root, '#menu-retry')
    this.btnNewWorld = must(root, '#menu-new-world')
    this.btnFs = must(root, '#menu-fullscreen')
    this.fsState = must(root, '#menu-fs-state')
    this.btnClose = must(root, '#menu-close')
    this.root.addEventListener('keydown', this.onKeyDown)
  }

  get open(): boolean {
    return !this.disposed && !this.root.hidden
  }

  get paused(): boolean {
    return this.open && this.mode === 'pause'
  }

  showTitlePage(page: 'controls' | 'info'): void {
    if (this.disposed) return
    this.rememberFocus()
    this.mode = 'title'
    this.root.hidden = false
    this.showView(page)
    this.syncChrome()
  }

  togglePause(): void {
    if (this.disposed) return
    if (this.mode === 'pause' && this.open) {
      this.handleEscape()
      return
    }
    this.openPause()
  }

  handleEscape(): void {
    if (this.disposed || !this.open) return
    if (this.view !== 'root') {
      this.showView('root')
      this.syncChrome()
      return
    }
    this.close()
  }

  openPause(): void {
    if (this.disposed) return
    this.rememberFocus()
    this.mode = 'pause'
    this.root.hidden = false
    this.showView('root')
    this.syncChrome()
    this.btnResume.focus({ preventScroll: true })
  }

  close(): void {
    if (this.disposed) return
    this.root.hidden = true
    this.view = 'root'
    const target = this.returnFocus
    this.returnFocus = null
    if (target?.isConnected && !target.closest('[hidden]')) {
      target.focus({ preventScroll: true })
    }
  }

  /** Release the menu-owned keyboard trap during runtime teardown. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeEventListener('keydown', this.onKeyDown)
    this.returnFocus = null
  }

  back(): void {
    if (this.disposed) return
    if (this.view !== 'root') {
      this.showView('root')
      this.syncChrome()
      return
    }
    if (this.mode === 'title') this.close()
    else this.close()
  }

  showView(view: MenuView): void {
    if (this.disposed) return
    this.view = view
    this.panelRoot.hidden = view !== 'root'
    this.panelControls.hidden = view !== 'controls'
    this.panelInfo.hidden = view !== 'info'
    this.focusHeading()
  }

  syncFullscreen(): void {
    if (this.disposed) return
    const on = !!document.fullscreenElement
    this.fsState.textContent = on ? 'ON' : 'OFF'
    this.btnFs.setAttribute('aria-pressed', on ? 'true' : 'false')
  }

  private syncChrome(): void {
    const pause = this.mode === 'pause'
    this.heading.textContent = pause ? 'Paused' : 'Settings'
    this.btnResume.hidden = !pause
    this.btnRetry.hidden = !pause
    this.btnNewWorld.hidden = !pause
    this.btnQuit.hidden = !pause
    this.btnClose.hidden = pause
    this.syncFullscreen()
  }

  private rememberFocus(): void {
    const active = document.activeElement
    this.returnFocus = active instanceof HTMLElement ? active : null
  }

  private focusHeading(): void {
    if (!this.open) return
    const panel = this.view === 'root'
      ? this.panelRoot
      : this.view === 'controls'
        ? this.panelControls
        : this.panelInfo
    const heading = panel.querySelector('h2')
    if (!(heading instanceof HTMLElement)) return
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }

  private activeFocusable(): HTMLElement[] {
    const panel = this.view === 'root'
      ? this.panelRoot
      : this.view === 'controls'
        ? this.panelControls
        : this.panelInfo
    return Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not([hidden]):not([disabled]), select:not([hidden]), input:not([hidden]), [href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden && element.tabIndex >= 0)
  }
}

function must(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector(sel)
  if (!(el instanceof HTMLElement)) throw new Error(`menu missing ${sel}`)
  return el
}
