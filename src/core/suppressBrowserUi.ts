/**
 * Block the browser context menu so hold-RMB camera pan can work
 * (including while Shift is held for boost).
 *
 * Important: only kill the `contextmenu` event hard. Do NOT stopPropagation
 * on pointerdown/mousedown for button 2, or the camera handler never runs.
 */
export function suppressBrowserUi(canvas: HTMLCanvasElement): void {
  const blockMenu = (e: Event): void => {
    e.preventDefault()
    e.stopPropagation()
  }

  const cap: AddEventListenerOptions = { capture: true }

  for (const target of [window, document, document.documentElement, document.body, canvas]) {
    if (!target) continue
    target.addEventListener('contextmenu', blockMenu, cap)
  }

  // preventDefault on RMB press helps some UAs; do not stopImmediatePropagation
  const softenRightButton = (e: MouseEvent | PointerEvent): void => {
    if (e.button === 2) e.preventDefault()
  }
  window.addEventListener('pointerdown', softenRightButton, cap)
  window.addEventListener('mousedown', softenRightButton, cap)
  window.addEventListener('auxclick', (e: MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, cap)

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'ContextMenu' || (e.shiftKey && (e.key === 'F10' || e.code === 'F10'))) {
        e.preventDefault()
      }
    },
    cap,
  )

  document.oncontextmenu = () => false
  window.oncontextmenu = () => false
  canvas.oncontextmenu = () => false
  if (document.body) document.body.oncontextmenu = () => false

  canvas.tabIndex = 0
  canvas.style.outline = 'none'
  canvas.addEventListener('pointerdown', () => {
    canvas.focus({ preventScroll: true })
  })
}
