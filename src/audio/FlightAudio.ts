/**
 * Engine rumble + wind hiss via Web Audio.
 * Procedural noise only (no sample files). Levels follow throttle/boost and airspeed.
 */
export class FlightAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engineGain: GainNode | null = null
  private windGain: GainNode | null = null
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
    const boost = opts.boost && thr > 0.02
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
    this.engineFilter = engineFilter
    this.windFilter = windFilter
    this.engineSrc = engineSrc
    this.windSrc = windSrc
    this.built = true
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
