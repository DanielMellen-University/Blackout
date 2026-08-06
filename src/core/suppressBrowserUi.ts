/**
 * Hard-block native browser UI that fights game input (context menu, etc.).
 * Must run as early as possible. Capture phase + stopImmediatePropagation.
 *
 * Note: Some browsers (notably Firefox) intentionally show the native menu on
 * Shift+Right-Click as an accessibility escape hatch. Avoid binding gameplay
 * to Shift+RMB simultaneously (boost is Space, not Shift).
 */
export function suppressBrowserUi(canvas: HTMLCanvasElement): void {
  const block = (e: Event): void => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }

  const cap: AddEventListenerOptions = { capture: true }

  for (const target of [window, document, document.documentElement, document.body, canvas]) {
    if (!target) continue
    target.addEventListener('contextmenu', block, cap)
  }

  // Kill right-button path before contextmenu is synthesized
  const blockRightPointer = (e: PointerEvent | MouseEvent): void => {
    if ('button' in e && e.button === 2) {
      block(e)
    }
  }

  window.addEventListener('pointerdown', blockRightPointer, cap)
  window.addEventListener('mousedown', blockRightPointer, cap)
  window.addEventListener('mouseup', blockRightPointer, cap)
  window.addEventListener('auxclick', blockRightPointer, cap)
  canvas.addEventListener('pointerdown', blockRightPointer, cap)
  canvas.addEventListener('mousedown', blockRightPointer, cap)

  // Keyboard ways to open a context menu
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'ContextMenu' || (e.shiftKey && (e.key === 'F10' || e.code === 'F10'))) {
        block(e)
      }
    },
    cap,
  )

  // Property hooks (older path some UAs still honor)
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
