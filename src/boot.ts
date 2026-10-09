import { startupFailureCanRetry, startupFailureMessage } from './core/startupFailure'

const startupStarted = performance.now()

function revealGame(animate = false): void {
  document.documentElement.classList.remove('startup-loading')
  const app = document.getElementById('app')
  const finish = (): void => {
    document.getElementById('startup-screen')?.remove()
    app?.removeAttribute('inert')
    app?.removeAttribute('aria-hidden')
  }
  if (animate) {
    document.getElementById('startup-screen')?.classList.add('startup-leaving')
    setTimeout(finish, matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 500)
  } else finish()
}

// Reveal the complete deck only after runtime initialization, fonts, and a paint.
import('./main')
  .then(({ boot }) => boot())
  .then(async () => {
    await Promise.all([
      document.fonts.ready,
      new Promise<void>(resolve => setTimeout(resolve, Math.max(0, 3000 - (performance.now() - startupStarted)))),
    ])
    requestAnimationFrame(() => requestAnimationFrame(() => revealGame(true)))
  })
  .catch((err) => {
    console.error('[Blackout] Failed to start', err)
    const status = document.getElementById('title-status')
    if (status) status.textContent = startupFailureMessage(err)
    const playBtn = document.getElementById('btn-play')
    if (playBtn instanceof HTMLButtonElement) {
      if (startupFailureCanRetry(err)) {
        playBtn.disabled = false
        playBtn.textContent = 'RETRY'
        playBtn.setAttribute('aria-label', 'Retry world generation')
        playBtn.addEventListener('click', () => window.location.reload(), { once: true })
      } else {
        playBtn.disabled = true
      }
    }
    // Never strand startup failures behind the loader; expose existing recovery UI.
    revealGame()
  })
