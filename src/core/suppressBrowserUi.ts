/**
 * Block browser chrome that fights the flight game:
 * - Context menu (RMB look)
 * - Ctrl/Cmd+W (close tab) while holding brake + pitch, etc.
 * - Other common tab/window shortcuts
 *
 * Note: Chrome only fully honors some shortcuts (esp. Ctrl+W/T/N) via the
 * Keyboard Lock API, which requires fullscreen. `lockGameKeyboard()` is
 * called when the player hits Play.
 */

/** Codes used by flight / menu — always suppress browser default. */
const GAME_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'KeyR',
  'KeyG',
  'KeyC',
  'KeyN',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'Digit1',
  'Digit2',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'NumpadEnter',
  'Tab',
  'Backspace',
  'Slash',
  'Backslash',
])

/** Single letters that form dangerous Ctrl/Cmd combos. */
const CTRL_BLOCK_KEYS = new Set([
  'w', // close tab — critical with Ctrl+brake + W pitch
  't', // new tab
  'n', // new window
  'r', // reload (game also uses R alone for reset)
  's', // save page
  'p', // print
  'd', // bookmark
  'f', // find
  'g', // find next
  'h', // history
  'j', // downloads
  'l', // address bar
  'o', // open
  'u', // view source
  'b', // bookmarks bar
  'e', // search (some browsers)
  'k', // search bar
  'i', // devtools / info
  'm', // minimize (some)
  'q', // quit (mac)
  'y', // history redo
  'z', // undo
  '+',
  '-',
  '=',
  '_',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
])

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (t.isContentEditable) return true
  return false
}

function shouldBlockKeydown(e: KeyboardEvent): boolean {
  if (isEditableTarget(e.target)) return false

  const ctrl = e.ctrlKey || e.metaKey
  const alt = e.altKey
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()

  // Game keys alone or with any modifier
  if (GAME_CODES.has(e.code)) return true

  // Ctrl/Cmd + letter/digit (tab/window management, etc.)
  if (ctrl) {
    if (CTRL_BLOCK_KEYS.has(key)) return true
    if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) return true
    if (e.code.startsWith('Key')) return true
    // Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PageUp/Down
    if (
      e.code === 'Tab' ||
      e.code === 'PageUp' ||
      e.code === 'PageDown' ||
      e.code === 'F4' ||
      e.code === 'F5'
    ) {
      return true
    }
  }

  // Alt+Left/Right history, Alt+D address bar, Alt+F4 (best-effort)
  if (alt) {
    if (
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'KeyD' ||
      e.code === 'KeyF' ||
      e.code === 'KeyE' ||
      e.code === 'KeyS' ||
      e.code === 'Home' ||
      e.code === 'F4'
    ) {
      return true
    }
  }

  // Function keys that steal focus / reload
  if (
    e.code === 'F1' ||
    e.code === 'F3' ||
    e.code === 'F5' ||
    e.code === 'F6' ||
    e.code === 'F7' ||
    e.code === 'F11' // we'll handle fullscreen ourselves
  ) {
    return true
  }

  // Context menu key
  if (e.key === 'ContextMenu' || (e.shiftKey && e.code === 'F10')) return true

  return false
}

function blockBrowserShortcuts(e: KeyboardEvent): void {
  if (!shouldBlockKeydown(e)) return
  e.preventDefault()
  // Don't stopPropagation — game InputManager still needs the event
}

/**
 * Block the browser context menu so hold-RMB camera pan can work
 * (including while Shift is held for boost).
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

  const softenRightButton = (e: MouseEvent | PointerEvent): void => {
    if (e.button === 2) e.preventDefault()
  }
  window.addEventListener('pointerdown', softenRightButton, cap)
  window.addEventListener('mousedown', softenRightButton, cap)
  window.addEventListener(
    'auxclick',
    (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    cap,
  )

  // Capture-phase so we beat browser chrome for Ctrl+W etc. when allowed
  window.addEventListener('keydown', blockBrowserShortcuts, cap)
  document.addEventListener('keydown', blockBrowserShortcuts, cap)

  // Mid-click auto-scroll / open link
  window.addEventListener(
    'mousedown',
    (e) => {
      if (e.button === 1) e.preventDefault()
    },
    cap,
  )
  window.addEventListener(
    'auxclick',
    (e) => {
      if (e.button === 1) e.preventDefault()
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

/**
 * Enter fullscreen + Keyboard Lock so Chrome actually swallows Ctrl+W/T/N.
 * Safe to call from the Play button (user gesture required).
 */
export async function lockGameKeyboard(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    // Fullscreen denied — still try lock / rely on preventDefault
  }

  try {
    const kb = (
      navigator as Navigator & {
        keyboard?: { lock: (codes?: string[]) => Promise<void> }
      }
    ).keyboard
    if (kb?.lock) {
      await kb.lock([
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'KeyQ',
        'KeyE',
        'KeyR',
        'KeyG',
        'KeyC',
        'KeyN',
        'Space',
        'ShiftLeft',
        'ShiftRight',
        'ControlLeft',
        'ControlRight',
        'Digit1',
        'Digit2',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Tab',
        // Escape intentionally NOT locked — browser + game use it to exit fullscreen
        'F5',
      ])
    }
  } catch {
    // Keyboard Lock unsupported or not fullscreen yet
  }
}

/** Release keyboard lock + leave fullscreen (optional, e.g. future menu). */
export async function unlockGameKeyboard(): Promise<void> {
  try {
    const kb = (
      navigator as Navigator & {
        keyboard?: { unlock: () => void }
      }
    ).keyboard
    kb?.unlock?.()
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* ignore */
  }
}
