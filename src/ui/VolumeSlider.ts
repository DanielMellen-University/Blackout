import { audioVolumePercent, normalizeAudioVolume } from '../audio/AudioPreferences'

type SliderLike = Pick<HTMLInputElement, 'value' | 'setAttribute'>
type OutputLike = Pick<HTMLElement, 'textContent'>

/**
 * Show a volume on its range input and readout. Screen readers announce
 * the range's aria-valuetext, so it carries the same percent the readout shows
 * instead of the bare 0-100 slider value.
 */
export function syncVolumeSlider(
  range: SliderLike | null | undefined,
  output: OutputLike | null | undefined,
  volume: number,
): void {
  const safe = normalizeAudioVolume(volume)
  const percent = audioVolumePercent(safe)
  if (range) {
    range.value = String(Math.round(safe * 100))
    range.setAttribute('aria-valuetext', percent)
  }
  if (output) output.textContent = percent
}
