import { startupFailureCanRetry, startupFailureMessage } from './core/startupFailure'

// Keep the HTML title screen usable while the renderer, terrain, and flight
// runtime download as a lazy chunk. Startup errors still use the same retry
// affordance as the direct entry path.
import('./main')
  .then(({ boot }) => boot())
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
  })
