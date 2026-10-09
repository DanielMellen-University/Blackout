const startupScreen = (): HTMLElement | null => document.getElementById('startup-screen')

function setAppAvailable(available: boolean): void {
  document.documentElement.classList.toggle('startup-loading', !available)
  const app = document.getElementById('app')
  if (available) {
    app?.removeAttribute('inert')
    app?.removeAttribute('aria-hidden')
  } else {
    app?.setAttribute('inert', '')
    app?.setAttribute('aria-hidden', 'true')
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

/** Reuse the startup artwork during an in-game launch or retry transition. */
export async function showStartupScreen(minimumMs = 1500): Promise<void> {
  const screen = startupScreen()
  if (!screen) return
  const startedAt = performance.now()
  const caption = screen.querySelector<HTMLElement>('.startup-caption span')
  if (caption) caption.textContent = 'Loading'
  screen.hidden = false
  screen.classList.remove('startup-leaving')
  setAppAvailable(false)
  await wait(Math.max(0, minimumMs - (performance.now() - startedAt)))
  await nextPaint()
  await nextPaint()
  screen.classList.add('startup-leaving')
  await wait(matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 500)
  screen.hidden = true
  screen.classList.remove('startup-leaving')
  setAppAvailable(true)
}

/** Dismiss initial startup after prerequisites and its minimum display time. */
export async function finishStartupScreen(minimumRemainingMs: number): Promise<void> {
  await wait(Math.max(0, minimumRemainingMs))
  await nextPaint()
  await nextPaint()
  const screen = startupScreen()
  if (!screen) return
  screen.classList.add('startup-leaving')
  await wait(matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 500)
  screen.hidden = true
  screen.classList.remove('startup-leaving')
  setAppAvailable(true)
}

/** Keep the existing error and retry UI available if runtime initialization fails. */
export function revealStartupFailure(): void {
  const screen = startupScreen()
  if (screen) screen.hidden = true
  setAppAvailable(true)
}
