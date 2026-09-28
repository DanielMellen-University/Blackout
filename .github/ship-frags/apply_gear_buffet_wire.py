from pathlib import Path

p = Path('src/ui/HUD.ts')
t = p.read_text()
assert 'weatherBuffetLabel' not in t
marker_old = """/** Keep the visible weather label synchronized with the active front target. */
export function weatherDisplayLabel(value: unknown, transitioning: boolean): string {
  const label = typeof value === 'string' ? value.trim() : ''
  if (!label) return ''
  return transitioning === true ? `${label} · ${weatherTransitionLabel(true)}` : label
}
"""
marker_new = """/** Compact buffet cue when gated storm drive clears the HUD enter floor. */
export function weatherBuffetLabel(drive: number): string {
  if (!Number.isFinite(drive) || drive <= 0.2) return ''
  return 'BUFFET'
}

/** Keep the visible weather label synchronized with the active front target. */
export function weatherDisplayLabel(
  value: unknown,
  transitioning: boolean,
  buffetDrive = 0,
): string {
  const label = typeof value === 'string' ? value.trim() : ''
  if (!label) return ''
  const parts = [label]
  if (transitioning === true) parts.push(weatherTransitionLabel(true))
  const buffet = weatherBuffetLabel(buffetDrive)
  if (buffet) parts.push(buffet)
  return parts.join(' · ')
}
"""
assert marker_old in t
t = t.replace(marker_old, marker_new, 1)
old = """  private weatherCueValue: WeatherCue | null = null
  private weatherTransitionValue: boolean | null = null
  private weatherLabelValue = ''
"""
new = """  private weatherCueValue: WeatherCue | null = null
  private weatherTransitionValue: boolean | null = null
  private weatherBuffetActive = false
  private weatherLabelValue = ''
"""
assert old in t
t = t.replace(old, new, 1)
old = """    weatherTransitioning?: boolean
    dayPhase?: string
"""
new = """    weatherTransitioning?: boolean
    /** Gated storm-buffet drive (after motion gates and gear scale). */
    stormBuffetDrive?: number
    dayPhase?: string
"""
assert old in t
t = t.replace(old, new, 1)
old = """    if (this.weatherEl && opts.weather) {
      const transitioning = opts.weatherTransitioning === true
      const cue = weatherCue(opts.weatherKind ?? opts.weather)
      if (
        cue !== this.weatherCueValue ||
        transitioning !== this.weatherTransitionValue ||
        opts.weather !== this.weatherLabelValue ||
        this.weatherText.length === 0
      ) {
        this.weatherCueValue = cue
        this.weatherTransitionValue = transitioning
        this.weatherLabelValue = opts.weather
        this.weatherText = weatherDisplayLabel(opts.weather, transitioning)
        this.weatherAriaText = cue === 'severe'
          ? `Severe weather: ${opts.weather}`
          : cue === 'active' ? `Active weather: ${opts.weather}` : `Weather: ${opts.weather}`
        if (transitioning) this.weatherAriaText += ', front shifting'
      }
"""
new = """    if (this.weatherEl && opts.weather) {
      const transitioning = opts.weatherTransitioning === true
      const buffetDrive = Number.isFinite(opts.stormBuffetDrive) ? opts.stormBuffetDrive! : 0
      const buffetActive = buffetDrive > 0.2
      const cue = weatherCue(opts.weatherKind ?? opts.weather)
      if (
        cue !== this.weatherCueValue ||
        transitioning !== this.weatherTransitionValue ||
        buffetActive !== this.weatherBuffetActive ||
        opts.weather !== this.weatherLabelValue ||
        this.weatherText.length === 0
      ) {
        this.weatherCueValue = cue
        this.weatherTransitionValue = transitioning
        this.weatherBuffetActive = buffetActive
        this.weatherLabelValue = opts.weather
        this.weatherText = weatherDisplayLabel(opts.weather, transitioning, buffetDrive)
        this.weatherAriaText = cue === 'severe'
          ? `Severe weather: ${opts.weather}`
          : cue === 'active' ? `Active weather: ${opts.weather}` : `Weather: ${opts.weather}`
        if (transitioning) this.weatherAriaText += ', front shifting'
        if (buffetActive) this.weatherAriaText += ', storm buffet'
      }
"""
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)
print('HUD ok')

p = Path('src/main.ts')
t = p.read_text()
assert 'stormBuffetGearScale' not in t
t = t.replace("import { stormBuffetDrive } from './systems/StormBuffet'\n", "import { stormBuffetDrive, stormBuffetGearScale } from './systems/StormBuffet'\n", 1)
t = t.replace("    let visualDt = 0\n    let simDt = 0\n    if (!simLive) {\n", "    let visualDt = 0\n    let simDt = 0\n    let stormDrive = 0\n    if (!simLive) {\n", 1)
old = """      const stormDrive = stormBuffetDrive(weather.rain, weather.snow, weather.gust, {
        reducedMotion,
        paused: menu.paused,
        playing,
      })
      aircraft.setStormBuffet(stormDrive)
"""
new = """      stormDrive = stormBuffetDrive(weather.rain, weather.snow, weather.gust, {
        reducedMotion,
        paused: menu.paused,
        playing,
      }) * stormBuffetGearScale(aircraft.controls.gearDown)
      aircraft.setStormBuffet(stormDrive)
"""
assert old in t
t = t.replace(old, new, 1)
old = """      hudFrame.weatherGust = precipitation.gust
      hudFrame.dayPhase = world.atmosphere.phaseLabel
"""
new = """      hudFrame.weatherGust = precipitation.gust
      hudFrame.stormBuffetDrive = stormDrive
      hudFrame.dayPhase = world.atmosphere.phaseLabel
"""
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)
print('main ok')

p = Path('tests/hud.test.ts')
t = p.read_text()
assert 'weatherBuffetLabel(0.21)' not in t
needle = "  weatherCue,\n  weatherCycleBanner,\n  weatherDisplayLabel,\n  weatherTransitionLabel,"
assert needle in t
t = t.replace(needle, "  weatherBuffetLabel,\n" + needle, 1)
old = """    expect(weatherDisplayLabel('RAIN FRONT', true)).toBe('RAIN FRONT · SHIFT')
    expect(weatherDisplayLabel('  SNOW SHOWERS  ', false)).toBe('SNOW SHOWERS')
    expect(weatherDisplayLabel('', true)).toBe('')
"""
new = old + """    expect(weatherBuffetLabel(0.19)).toBe('')
    expect(weatherBuffetLabel(0.21)).toBe('BUFFET')
    expect(weatherBuffetLabel(Number.NaN)).toBe('')
    expect(weatherDisplayLabel('STORM', false, 0.55)).toBe('STORM · BUFFET')
    expect(weatherDisplayLabel('RAIN FRONT', true, 0.8)).toBe('RAIN FRONT · SHIFT · BUFFET')
    expect(weatherDisplayLabel('CLEAR', false, 0.1)).toBe('CLEAR')
"""
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)
print('hud.test ok')

p = Path('CHANGELOG.md')
t = p.read_text()
assert 'Dampen storm buffet while landing gear' not in t
marker = '### Ship\n\n'
i = t.find(marker)
assert i >= 0
bullet = '- Dampen storm buffet while landing gear is down, and cue BUFFET on the live weather HUD when the gated drive is meaningful.\n'
p.write_text(t[:i] + marker + bullet + t[i+len(marker):])
print('CHANGELOG ok')

p = Path('README.md')
t = p.read_text()
old = 'Meaningful rain, snow, or strong gusts add a restrained camera and airframe buffet that stays quiet under reduced-motion preferences.'
new = 'Meaningful rain, snow, or strong gusts add a restrained camera and airframe buffet that damps with gear down, cues on the live weather HUD, and stays quiet under reduced-motion preferences.'
assert old in t
p.write_text(t.replace(old, new, 1))
print('README ok')
print('ALL OK')
