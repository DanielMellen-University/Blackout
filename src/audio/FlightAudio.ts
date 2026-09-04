/**
 * Engine rumble + wind hiss via Web Audio.
 * Procedural noise only (no sample files). Levels follow throttle/boost and airspeed.
 */
export class FlightAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engineGain: GainNode | null = null
  private windGain: GainNode | null = null
  private effectsGain: GainNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private engineSrc: AudioBufferSourceNode | null = null
  private windSrc: AudioBufferSourceNode | null = null
  private built = false
  private muted = true

  /**
   * Resume (or create) the AudioContext from a user gesture such as Play.
   * Safe to call repeatedly.
   */
  async resume(): Promise<void> {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!AC) return
        this.ctx = new AC()
      }
      if (!this.built) this.buildGraph(this.ctx)
      if (this.ctx.state === 'suspended') await this.ctx.resume()
    } catch {
      /* Audio unavailable: stay silent */
    }
  }

  /**
   * Per-frame levels. Pass mute on title, pause, or crash.
   * speed is m/s (same as Aircraft.speed).
   */
  update(opts: {
    throttle: number
    boost: boolean
    speed: number
    mute: boolean
    dt: number
  }): void {
    const ctx = this.ctx
    if (!ctx || !this.built || !this.master || !this.engineGain || !this.windGain) {
      return
    }
    if (ctx.state === 'suspended') return

    const thr = clamp01(opts.throttle)
    const boost = opts.boost
    // Dry lever fills most of the rumble; AB adds a clear bump on top.
    const engLevel = thr * 0.78 + (boost ? 0.35 : 0) * (0.55 + thr * 0.45)
    const eng = Math.min(1, engLevel)

    // Wind starts after a taxi crawl, strong by cruise (~400+ kts).
    const windT = clamp01((opts.speed - 18) / 280)
    const wind = windT * windT

    this.muted = opts.mute
    const masterTarget = opts.mute ? 0 : 1
    const engTarget = opts.mute ? 0 : eng * 0.42
    const windTarget = opts.mute ? 0 : wind * 0.28

    const now = ctx.currentTime
    const tau = Math.max(0.04, Math.min(0.12, opts.dt * 3))

    this.master.gain.setTargetAtTime(masterTarget, now, tau)
    this.engineGain.gain.setTargetAtTime(engTarget, now, tau)
    this.windGain.gain.setTargetAtTime(windTarget, now, tau)

    if (this.engineFilter) {
      // Idle growl stays low; spool opens the filter a bit.
      const cut = 90 + eng * 160 + (boost ? 70 : 0)
      this.engineFilter.frequency.setTargetAtTime(cut, now, tau)
    }
    if (this.windFilter) {
      const cut = 900 + wind * 2200
      this.windFilter.frequency.setTargetAtTime(cut, now, tau)
    }
  }

  /** Hard silence (e.g. before dispose). */
  silence(): void {
    if (!this.master || !this.ctx) return
    this.muted = true
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05)
  }

  /** Short event cues keep checkpoints and landings readable without assets. */
  playCue(kind: 'gate' | 'complete' | 'landed' | 'crash'): void {
    const ctx = this.ctx
    const output = this.effectsGain
    if (!ctx || !output || ctx.state === 'suspended' || this.muted) return

    const now = ctx.currentTime
    if (kind === 'gate') {
      this.tone(740, now, 0.11, 'sine', 0.18)
      this.tone(980, now + 0.08, 0.14, 'sine', 0.14)
    } else if (kind === 'complete') {
      this.tone(520, now, 0.13, 'triangle', 0.16)
      this.tone(660, now + 0.11, 0.13, 'triangle', 0.16)
      this.tone(880, now + 0.22, 0.28, 'triangle', 0.18)
    } else if (kind === 'landed') {
      this.tone(420, now, 0.16, 'sine', 0.15)
      this.tone(620, now + 0.14, 0.26, 'sine', 0.16)
    } else {
      this.tone(110, now, 0.5, 'sawtooth', 0.22, 42)
      this.tone(58, now + 0.06, 0.7, 'triangle', 0.2, 28)
    }
  }

  dispose(): void {
    try {
      this.engineSrc?.stop()
      this.windSrc?.stop()
    } catch {
      /* already stopped */
    }
    this.engineSrc = null
    this.windSrc = null
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.engineGain = null
    this.windGain = null
    this.effectsGain = null
    this.engineFilter = null
    this.windFilter = null
    this.built = false
  }

  get isMuted(): boolean {
    return this.muted
  }

  private buildGraph(ctx: AudioContext): void {
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    const engineGain = ctx.createGain()
    engineGain.gain.value = 0
    const engineFilter = ctx.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 120
    engineFilter.Q.value = 0.7
    engineGain.connect(engineFilter)
    engineFilter.connect(master)

    const windGain = ctx.createGain()
    windGain.gain.value = 0
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 1400
    windFilter.Q.value = 0.55
    windGain.connect(windFilter)
    windFilter.connect(master)

    const effectsGain = ctx.createGain()
    effectsGain.gain.value = 0.8
    effectsGain.connect(ctx.destination)

    const engBuf = makeNoiseBuffer(ctx, 2.5, 'brown')
    const windBuf = makeNoiseBuffer(ctx, 2.0, 'white')

    const engineSrc = ctx.createBufferSource()
    engineSrc.buffer = engBuf
    engineSrc.loop = true
    engineSrc.connect(engineGain)
    engineSrc.start()

    const windSrc = ctx.createBufferSource()
    windSrc.buffer = windBuf
    windSrc.loop = true
    windSrc.connect(windGain)
    windSrc.start()

    this.master = master
    this.engineGain = engineGain
    this.windGain = windGain
    this.effectsGain = effectsGain
    this.engineFilter = engineFilter
    this.windFilter = windFilter
    this.engineSrc = engineSrc
    this.windSrc = windSrc
    this.built = true
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
  ): void {
    const ctx = this.ctx
    const output = this.effectsGain
    if (!ctx || !output) return

    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(output)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect()
      gain.disconnect()
    })
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function makeNoiseBuffer(
  ctx: AudioContext,
  seconds: number,
  kind: 'white' | 'brown',
): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.max(1, Math.floor(rate * seconds))
  const buf = ctx.createBuffer(1, len, rate)
  const data = buf.getChannelData(0)
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  } else {
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = Math.max(-1, Math.min(1, last * 3.5))
    }
  }
  return buf
}
