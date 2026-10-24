type Loop = { stop(): void }

export class GameAudio {
  readonly ctx: AudioContext
  private readonly master: GainNode
  private readonly noise: AudioBuffer
  private loops = new Set<Loop>()
  private engine: { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null

  private constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.7
    this.master.connect(this.ctx.destination)

    const length = this.ctx.sampleRate * 2
    this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }

  static create(): GameAudio | null {
    try {
      const audio = new GameAudio()
      void audio.ctx.resume()
      return audio
    } catch {
      return null
    }
  }

  get now() {
    return this.ctx.currentTime
  }

  pause() {
    void this.ctx.suspend()
  }

  resume() {
    void this.ctx.resume()
  }

  close() {
    this.silence()
    void this.ctx.close()
  }

  private envelope(peak: number, attack: number, hold: number, release: number, at = this.now) {
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + attack)
    gain.gain.setValueAtTime(peak, at + attack + hold)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release)
    gain.connect(this.master)
    return gain
  }

  private noiseSource(loop = false) {
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = loop
    return source
  }

  private filter(type: BiquadFilterType, frequency: number, q = 1) {
    const node = this.ctx.createBiquadFilter()
    node.type = type
    node.frequency.value = frequency
    node.Q.value = q
    return node
  }

  private tone(type: OscillatorType, frequency: number, duration: number, peak: number, at = this.now) {
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, at)
    osc.connect(this.envelope(peak, 0.01, duration * 0.6, duration * 0.4, at))
    osc.start(at)
    osc.stop(at + duration + 0.05)
    return osc
  }

  private burst(filter: BiquadFilterNode, peak: number, attack: number, hold: number, release: number) {
    const source = this.noiseSource()
    source.connect(filter)
    filter.connect(this.envelope(peak, attack, hold, release))
    source.start()
    source.stop(this.now + attack + hold + release + 0.05)
    return source
  }

  private noiseLoop(filter: BiquadFilterNode, level: number, fadeIn = 1): Loop {
    const source = this.noiseSource(true)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, this.now)
    gain.gain.exponentialRampToValueAtTime(level, this.now + fadeIn)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start()
    const loop: Loop = {
      stop: () => {
        gain.gain.cancelScheduledValues(this.now)
        gain.gain.setTargetAtTime(0.0001, this.now, 0.3)
        source.stop(this.now + 1.5)
        this.loops.delete(loop)
      },
    }
    this.loops.add(loop)
    return loop
  }

  beep(high = false) {
    this.tone('square', high ? 880 : 440, high ? 0.5 : 0.25, 0.18)
  }

  tireScreech() {
    const sweep = this.ctx.createOscillator()
    sweep.type = 'sawtooth'
    sweep.frequency.setValueAtTime(1800, this.now)
    sweep.frequency.linearRampToValueAtTime(1200, this.now + 1.4)
    const band = this.filter('bandpass', 2400, 6)
    sweep.connect(band)
    band.connect(this.envelope(0.08, 0.05, 0.8, 0.6))
    sweep.start()
    sweep.stop(this.now + 1.6)
    this.burst(this.filter('bandpass', 3000, 3), 0.25, 0.05, 0.8, 0.6)
  }

  passBy() {
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(420, this.now)
    osc.frequency.exponentialRampToValueAtTime(190, this.now + 1.2)
    const low = this.filter('lowpass', 1200)
    osc.connect(low)
    low.connect(this.envelope(0.12, 0.5, 0.1, 0.6))
    osc.start()
    osc.stop(this.now + 1.3)
  }

  metalGrind() {
    const square = this.ctx.createOscillator()
    square.type = 'square'
    square.frequency.value = 92
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 28
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 40
    lfo.connect(lfoGain)
    lfoGain.connect(square.frequency)
    const band = this.filter('bandpass', 900, 2)
    square.connect(band)
    band.connect(this.envelope(0.14, 0.1, 1.4, 0.6))
    square.start()
    lfo.start()
    square.stop(this.now + 2.2)
    lfo.stop(this.now + 2.2)
    this.burst(this.filter('bandpass', 1300, 4), 0.2, 0.1, 1.4, 0.6)
  }

  radioClick() {
    this.burst(this.filter('highpass', 2000), 0.25, 0.005, 0.03, 0.05)
  }

  radioStatic(seconds: number) {
    this.burst(this.filter('bandpass', 2800, 0.8), 0.09, 0.05, seconds, 0.3)
  }

  impactWrench() {
    for (let i = 0; i < 3; i++) {
      const at = this.now + i * 0.32
      const osc = this.ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(170, at)
      const lfo = this.ctx.createOscillator()
      lfo.type = 'square'
      lfo.frequency.value = 45
      const depth = this.ctx.createGain()
      depth.gain.value = 0.5
      const amp = this.ctx.createGain()
      amp.gain.value = 0.5
      lfo.connect(depth)
      depth.connect(amp.gain)
      osc.connect(amp)
      amp.connect(this.envelope(0.06, 0.01, 0.16, 0.06, at))
      osc.start(at)
      lfo.start(at)
      osc.stop(at + 0.3)
      lfo.stop(at + 0.3)
    }
  }

  overheatAlarm(seconds: number) {
    for (let t = 0; t < seconds; t += 0.5) {
      this.tone('square', 988, 0.18, 0.05, this.now + t)
      this.tone('square', 740, 0.18, 0.05, this.now + t + 0.25)
    }
  }

  crash() {
    const low = this.filter('lowpass', 5000)
    low.frequency.setValueAtTime(5000, this.now)
    low.frequency.exponentialRampToValueAtTime(150, this.now + 1.8)
    this.burst(low, 0.9, 0.005, 0.15, 1.8)
    const thump = this.ctx.createOscillator()
    thump.frequency.setValueAtTime(90, this.now)
    thump.frequency.exponentialRampToValueAtTime(30, this.now + 0.6)
    thump.connect(this.envelope(0.8, 0.005, 0.1, 0.7))
    thump.start()
    thump.stop(this.now + 0.9)
  }

  shutter() {
    this.burst(this.filter('highpass', 3000), 0.35, 0.002, 0.02, 0.04)
    window.setTimeout(() => this.burst(this.filter('highpass', 2500), 0.25, 0.002, 0.02, 0.06), 90)
  }

  footstep() {
    this.burst(this.filter('lowpass', 420), 0.22, 0.004, 0.03, 0.12)
  }

  door() {
    const creak = this.ctx.createOscillator()
    creak.type = 'sawtooth'
    creak.frequency.setValueAtTime(240, this.now)
    creak.frequency.linearRampToValueAtTime(170, this.now + 0.9)
    const band = this.filter('bandpass', 900, 8)
    creak.connect(band)
    band.connect(this.envelope(0.05, 0.1, 0.5, 0.3))
    creak.start()
    creak.stop(this.now + 1)
  }

  doorShut() {
    this.burst(this.filter('lowpass', 260), 0.35, 0.004, 0.04, 0.25)
    this.tone('sine', 70, 0.2, 0.2)
  }

  sigh() {
    this.burst(this.filter('bandpass', 750, 0.8), 0.12, 0.35, 0.2, 0.9)
  }

  wrongSting() {
    this.burst(this.filter('lowpass', 300), 0.3, 0.005, 0.05, 0.6)
    this.tone('sine', 82, 1.8, 0.35)
    this.tone('triangle', 77.8, 2.2, 0.1)
  }

  paperSlap() {
    this.burst(this.filter('bandpass', 1800, 0.7), 0.4, 0.003, 0.04, 0.18)
    this.tone('sine', 120, 0.12, 0.25)
  }

  stamp() {
    const thump = this.ctx.createOscillator()
    thump.frequency.setValueAtTime(140, this.now)
    thump.frequency.exponentialRampToValueAtTime(40, this.now + 0.25)
    thump.connect(this.envelope(0.7, 0.003, 0.05, 0.3))
    thump.start()
    thump.stop(this.now + 0.4)
    this.burst(this.filter('lowpass', 900), 0.3, 0.003, 0.03, 0.15)
  }

  roomTone() {
    return this.noiseLoop(this.filter('bandpass', 120, 4), 0.05, 1.5)
  }

  fire(): Loop {
    const roar = this.noiseLoop(this.filter('lowpass', 520), 0.11, 0.8)
    const timer = window.setInterval(() => {
      if (this.ctx.state !== 'running') return
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.55) {
          window.setTimeout(() => this.burst(this.filter('highpass', 2000 + Math.random() * 3000), 0.04 + Math.random() * 0.09, 0.002, 0.004, 0.03), Math.random() * 180)
        }
      }
    }, 200)
    const loop: Loop = {
      stop: () => {
        window.clearInterval(timer)
        if (this.loops.has(roar)) roar.stop()
        this.loops.delete(loop)
      },
    }
    this.loops.add(loop)
    return loop
  }

  crowd() {
    return this.noiseLoop(this.filter('bandpass', 700, 0.6), 0.06, 2)
  }

  wind() {
    return this.noiseLoop(this.filter('lowpass', 380), 0.12, 1.5)
  }

  rain() {
    return this.noiseLoop(this.filter('highpass', 1600), 0.05, 1)
  }

  engineStart() {
    if (this.engine) return
    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    const filter = this.filter('lowpass', 900)
    const osc = [0, 7].map((detune) => {
      const node = this.ctx.createOscillator()
      node.type = 'sawtooth'
      node.frequency.value = 70
      node.detune.value = detune
      node.connect(filter)
      node.start()
      return node
    })
    filter.connect(gain)
    gain.connect(this.master)
    this.engine = { osc, gain, filter }
  }

  engineSet(rpm: number, level: number, ramp = 0.3) {
    if (!this.engine) this.engineStart()
    const { osc, gain, filter } = this.engine!
    const frequency = 60 + rpm * 260
    osc.forEach((node) => node.frequency.setTargetAtTime(frequency, this.now, ramp))
    filter.frequency.setTargetAtTime(600 + rpm * 2400, this.now, ramp)
    gain.gain.setTargetAtTime(Math.max(0.0001, level), this.now, ramp)
  }

  engineStop(fast = false) {
    if (!this.engine) return
    const { osc, gain } = this.engine
    gain.gain.cancelScheduledValues(this.now)
    gain.gain.setTargetAtTime(0.0001, this.now, fast ? 0.01 : 0.4)
    osc.forEach((node) => node.stop(this.now + (fast ? 0.1 : 2)))
    this.engine = null
  }

  silence() {
    this.engineStop(true)
    this.loops.forEach((loop) => loop.stop())
    this.loops.clear()
  }
}
