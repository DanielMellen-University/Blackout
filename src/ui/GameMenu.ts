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
  }

  get open(): boolean {
    return !this.root.hidden
  }

  get paused(): boolean {
    return this.open && this.mode === 'pause'
  }

  showTitlePage(page: 'controls' | 'info'): void {
    this.mode = 'title'
    this.root.hidden = false
    this.showView(page)
    this.syncChrome()
  }

  togglePause(): void {
    if (this.mode === 'pause' && this.open) {
      this.handleEscape()
      return
    }
    this.openPause()
  }

  handleEscape(): void {
    if (!this.open) return
    if (this.view !== 'root') {
      this.showView('root')
      this.syncChrome()
      return
    }
    this.close()
  }

  openPause(): void {
    this.mode = 'pause'
    this.root.hidden = false
    this.showView('root')
    this.syncChrome()
    this.btnResume.focus({ preventScroll: true })
  }

  close(): void {
    this.root.hidden = true
    this.view = 'root'
  }

  back(): void {
    if (this.view !== 'root') {
      this.showView('root')
      this.syncChrome()
      return
    }
    if (this.mode === 'title') this.close()
    else this.close()
  }

  showView(view: MenuView): void {
    this.view = view
    this.panelRoot.hidden = view !== 'root'
    this.panelControls.hidden = view !== 'controls'
    this.panelInfo.hidden = view !== 'info'
  }

  syncFullscreen(): void {
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
}

function must(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector(sel)
  if (!(el instanceof HTMLElement)) throw new Error(`menu missing ${sel}`)
  return el
}
