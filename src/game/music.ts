export type TrackId = 'menu' | 'tension' | 'interrogation' | 'premonition' | 'garage' | 'jazz' | 'sad' | 'victory'

type SynthId = Exclude<TrackId, 'menu' | 'premonition'>

const files: Partial<Record<TrackId, { src: string; fallback: SynthId }>> = {
  menu: { src: 'music/once-upon-a-time.mp3', fallback: 'sad' },
  premonition: { src: 'music/premonition.mp3', fallback: 'tension' },
}

const VOLUME = 0.75
const FADE = 1.5
const LEVELS: Record<SynthId, number> = { tension: 1.7, interrogation: 3.5, garage: 4, jazz: 2.6, sad: 3.8, victory: 5.5 }

interface Playing {
  id: TrackId
  gain: GainNode
  stop(): void
}

interface Kit {
  ctx: AudioContext
  out: GainNode
  noise: AudioBuffer
}

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12)

function note(
  { ctx, out }: Kit,
  type: OscillatorType,
  frequency: number,
  at: number,
  length: number,
  peak: number,
  { attack = 0.02, filter = 0, vibrato = 0 } = {},
) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = frequency
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  let head: AudioNode = osc
  if (filter) {
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = filter
    osc.connect(low)
    head = low
  }
  if (vibrato) {
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5
    const depth = ctx.createGain()
    depth.gain.value = vibrato
    lfo.connect(depth)
    depth.connect(osc.frequency)
    lfo.start(at)
    lfo.stop(at + length + 0.05)
  }
  head.connect(gain)
  gain.connect(out)
  osc.start(at)
  osc.stop(at + length + 0.05)
}

function hiss({ ctx, out, noise }: Kit, type: BiquadFilterType, frequency: number, at: number, length: number, peak: number, q = 1, attack = 0.003) {
  const source = ctx.createBufferSource()
  source.buffer = noise
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  source.start(at, Math.random())
  source.stop(at + length + 0.05)
}

function thump({ ctx, out }: Kit, at: number, from: number, to: number, length: number, peak: number) {
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.7)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain)
  gain.connect(out)
  osc.start(at)
  osc.stop(at + length + 0.05)
}

function drone({ ctx, out }: Kit, type: OscillatorType, frequency: number, filter = 0) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = frequency
  const gain = ctx.createGain()
  gain.gain.value = 0.0001
  let head: AudioNode = osc
  if (filter) {
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = filter
    osc.connect(low)
    head = low
  }
  head.connect(gain)
  gain.connect(out)
  osc.start()
  return {
    level: (value: number, at: number) => gain.gain.setTargetAtTime(Math.max(0.0001, value), at, 1.5),
    stop: () => osc.stop(),
  }
}

function sequence(kit: Kit, onStep: (step: number, at: number) => number) {
  let step = 0
  let next = kit.ctx.currentTime + 0.1
  const schedule = () => {
    while (next < kit.ctx.currentTime + 0.6) next += onStep(step++, next)
  }
  schedule()
  const timer = window.setInterval(schedule, 120)
  return () => window.clearInterval(timer)
}

function tension(kit: Kit) {
  const start = kit.ctx.currentTime
  const build = (at: number) => Math.min(1, (at - start) / 70)
  const low = [drone(kit, 'triangle', 55), drone(kit, 'sine', 110)]
  const clash = drone(kit, 'triangle', 58.27)
  const pad = [drone(kit, 'sawtooth', 220, 900), drone(kit, 'sawtooth', 329.6, 900), drone(kit, 'sawtooth', 349.2, 900)]
  const motif = [57, 60, 59, 58, 57, 56, 57, 53]
  const stopSequence = sequence(kit, (step, at) => {
    const k = build(at)
    const beat = 1.05 - 0.5 * k
    low[0].level(0.07, at)
    low[1].level(0.03 + 0.03 * k, at)
    clash.level(0.045 * Math.max(0, k - 0.25), at)
    pad[0].level(0.022, at)
    pad[1].level(0.016, at)
    pad[2].level(0.004 + 0.014 * k, at)

    thump(kit, at, 95, 42, 0.25, 0.22 + 0.1 * k)
    thump(kit, at + beat * 0.24, 95, 42, 0.22, 0.13 + 0.06 * k)
    hiss(kit, 'bandpass', 900, at, 0.06, 0.05 + 0.03 * k, 1.5)

    if (k > 0.2) hiss(kit, 'highpass', 7000, at + beat / 2, 0.04, 0.03 * k)
    if (k > 0.45) hiss(kit, 'highpass', 7000, at, 0.04, 0.025 * k)

    if (step % 2 === 1) {
      const pitch = motif[(step >> 1) % motif.length]
      note(kit, 'triangle', midi(pitch + 12), at, beat * 1.8, 0.06 + 0.03 * k)
    }

    if (k > 0.4) {
      const pair = step % 4 < 2 ? [76, 77] : [75, 76]
      for (let i = 0; i < 4; i++) {
        note(kit, 'sawtooth', midi(pair[i % 2]), at + (beat / 4) * i, beat / 4, 0.012 * k, { attack: 0.01, filter: 2200 })
      }
    }

    if (k > 0.7) {
      for (const offset of [0, 0.5]) note(kit, 'sawtooth', 55, at + beat * offset, beat * 0.4, 0.05 * k, { filter: 300 })
    }
    return beat
  })
  return () => {
    stopSequence()
    ;[...low, clash, ...pad].forEach((voice) => voice.stop())
  }
}

function interrogation(kit: Kit) {
  const eighth = 60 / 72 / 2
  const chords = [
    [52, 55, 59, 66],
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [47, 51, 54, 57],
  ]
  const bells = [76, 79, 83, 81, 78, 74, 71]
  let bell = 0
  return sequence(kit, (step, at) => {
    const bar = Math.floor(step / 8)
    const chord = chords[Math.floor(bar / 2) % chords.length]
    const root = chord[0] - 24

    if (step % 2 === 0) hiss(kit, step % 4 === 0 ? 'highpass' : 'bandpass', step % 4 === 0 ? 7000 : 2400, at, 0.03, 0.05, 4)

    const walk = [root, root + 7, chord[2] - 12, root + 7][Math.floor(step / 2) % 4]
    if (step % 2 === 0) note(kit, 'triangle', midi(walk), at, eighth * 1.8, 0.12, { filter: 900 })

    if (step % 16 === 0) {
      chord.forEach((pitch) => note(kit, 'sawtooth', midi(pitch), at, eighth * 16, 0.012, { attack: 1.2, filter: 1100 }))
      note(kit, 'sine', midi(chord[3] + 12), at, eighth * 16, 0.015, { attack: 1.5 })
    }

    if (step % 16 === 11 && bar % 4 !== 3) {
      const pitch = midi(bells[bell++ % bells.length])
      note(kit, 'sine', pitch, at, 1.6, 0.06, { attack: 0.004 })
      note(kit, 'sine', pitch, at + eighth * 1.5, 1.4, 0.025, { attack: 0.004 })
      note(kit, 'sine', pitch * 2, at, 0.5, 0.01, { attack: 0.004 })
    }
    return eighth
  })
}

function garage(kit: Kit) {
  const eighth = 0.32
  const bass = [38, 38, 41, 38, 36, 36, 39, 36]
  const chords = [
    [62, 65, 69],
    [58, 62, 65],
    [55, 58, 62],
    [57, 61, 64],
  ]
  const drops = [74, 77, 81, 72, 79]
  let drip = 0
  return sequence(kit, (step, at) => {
    const bar = Math.floor(step / 8)
    const chord = chords[Math.floor(bar / 2) % chords.length]
    const root = chord[0] - 24
    const pitch = bass[step % 8] + (root - 38)
    note(kit, 'triangle', midi(pitch), at, eighth * 0.9, 0.11, { filter: 600 })
    note(kit, 'triangle', midi(pitch + 24), at, eighth * 0.5, 0.025)

    if (step % 16 === 0) chord.forEach((pitch) => note(kit, 'sine', midi(pitch), at, eighth * 16, 0.025, { attack: 0.8 }))
    if (step % 4 === 2) {
      hiss(kit, 'bandpass', 2600, at, 0.12, 0.05, 14)
      note(kit, 'square', 1240, at, 0.08, 0.008)
    }
    if (step % 2 === 1) hiss(kit, 'highpass', 6000, at, 0.03, 0.015)
    if (step % 8 === 0) thump(kit, at, 80, 40, 0.3, 0.16)

    if (step % 8 === 5 && (bar + drip) % 3 === 0) {
      note(kit, 'sine', midi(drops[drip % drops.length]), at, 1.2, 0.03)
      drip++
    }
    return eighth
  })
}

function jazz(kit: Kit) {
  const beat = 60 / 86
  const swing = (position: number) => Math.floor(position) + (position % 1 ? 2 / 3 : 0)
  const bars = [
    { root: 36, chord: [51, 55, 58, 62] },
    { root: 36, chord: [51, 55, 58, 62] },
    { root: 41, chord: [56, 60, 63, 67] },
    { root: 41, chord: [56, 60, 63, 67] },
    { root: 38, chord: [53, 56, 60, 65] },
    { root: 43, chord: [53, 59, 62, 68] },
    { root: 36, chord: [51, 55, 58, 62] },
    { root: 43, chord: [53, 59, 62, 65] },
  ]
  const melody: [number, number, number, number][] = [
    [0, 0, 67, 1.5], [0, 1.5, 70, 0.5], [0, 2, 72, 2],
    [1, 0.5, 70, 0.5], [1, 1, 67, 1], [1, 2, 63, 2],
    [2, 0, 68, 1.5], [2, 1.5, 67, 0.5], [2, 2, 65, 1], [2, 3, 63, 1],
    [3, 0, 60, 3],
    [4, 0, 62, 0.5], [4, 0.5, 65, 0.5], [4, 1, 68, 1], [4, 2, 72, 2],
    [5, 0, 71, 1.5], [5, 1.5, 68, 0.5], [5, 2, 67, 2],
    [6, 0, 63, 1], [6, 1, 62, 1], [6, 2, 60, 2],
  ]
  return sequence(kit, (step, at) => {
    const barIndex = Math.floor(step / 4) % bars.length
    const cycle = Math.floor(step / 32)
    const { root, chord } = bars[barIndex]
    const next = bars[(barIndex + 1) % bars.length].root
    const inBar = step % 4

    const walk = [root, root + (chord[0] - root) % 12, root + 7, next + (step % 8 < 4 ? -1 : 1)]
    note(kit, 'triangle', midi(walk[inBar]), at, beat * 0.9, 0.16, { filter: 900 })

    hiss(kit, 'highpass', 8000, at, 0.18, 0.025)
    if (inBar === 1 || inBar === 3) {
      hiss(kit, 'highpass', 8000, at + beat * swing(0.5), 0.1, 0.018)
      hiss(kit, 'bandpass', 3000, at, 0.22, 0.035, 0.7, 0.04)
    }
    if (inBar === 0) thump(kit, at, 70, 45, 0.25, 0.08)

    if (inBar === 1 || (inBar === 3 && step % 8 === 7)) {
      const comp = at + beat * swing(0.5)
      chord.forEach((pitch) => {
        note(kit, 'sine', midi(pitch), comp, beat * 1.4, 0.03)
        note(kit, 'triangle', midi(pitch + 12), comp, beat * 0.5, 0.006)
      })
    }

    if (cycle % 2 === 1) {
      for (const [bar, position, pitch, length] of melody) {
        if (bar !== barIndex || Math.floor(position) !== inBar) continue
        const offset = swing(position) - inBar
        note(kit, 'square', midi(pitch), at + beat * offset, beat * length * 0.95, 0.03, {
          attack: 0.05,
          filter: 1300,
          vibrato: length >= 1.5 ? 4 : 0,
        })
      }
    }
    return beat
  })
}

function sad(kit: Kit) {
  const beat = 60 / 66
  const chords = [
    [57, 64, 69, 72],
    [53, 60, 65, 69],
    [48, 55, 64, 67],
    [43, 55, 62, 67],
    [57, 64, 69, 72],
    [53, 60, 65, 69],
    [50, 57, 62, 65],
    [52, 56, 59, 64],
  ]
  const melody: [number, number][][] = [
    [[76, 1], [74, 1], [72, 1]],
    [[72, 2], [69, 1]],
    [[67, 1], [72, 1], [76, 1]],
    [[74, 3]],
    [[76, 1], [74, 1], [72, 1]],
    [[69, 2], [72, 1]],
    [[69, 1], [65, 1], [62, 1]],
    [[68, 1.5], [71, 1.5]],
  ]
  return sequence(kit, (step, at) => {
    const barIndex = Math.floor(step / 6) % chords.length
    const cycle = Math.floor(step / 48)
    const chord = chords[barIndex]
    const half = beat / 2

    if (step % 6 === 0) {
      note(kit, 'triangle', midi(chord[0] - 12), at, beat * 3, 0.07, { attack: 0.3 })
      note(kit, 'sine', midi(chord[1]), at, beat * 3, 0.02, { attack: 0.6 })
      if (cycle % 2 === 0 || barIndex % 2 === 0) {
        let offset = 0
        for (const [pitch, length] of melody[barIndex]) {
          note(kit, 'sine', midi(pitch), at + offset * beat, length * beat * 1.1, 0.06, { attack: 0.04 })
          offset += length
        }
      }
    }
    const box = [chord[1], chord[2], chord[3], chord[2] + 12, chord[3], chord[2]][step % 6]
    note(kit, 'sine', midi(box + 12), at, 1.1, 0.025, { attack: 0.004 })
    note(kit, 'triangle', midi(box + 24), at, 0.4, 0.006, { attack: 0.004 })
    return half
  })
}

function victory(kit: Kit) {
  const beat = 60 / 96
  const bars = [
    [45, 57, 60, 64],
    [41, 57, 60, 65],
    [36, 55, 60, 64],
    [43, 55, 59, 62],
    [41, 57, 60, 65],
    [43, 55, 59, 62],
    [36, 55, 60, 65],
    [36, 55, 60, 64],
  ]
  const melody: [number, number, number, number][] = [
    [2, 0, 72, 1], [2, 1, 74, 1], [2, 2, 76, 2],
    [3, 0, 74, 3],
    [4, 0, 69, 1], [4, 1, 72, 1], [4, 2, 77, 2],
    [5, 0, 74, 1], [5, 1, 71, 1], [5, 2, 79, 2],
    [6, 0, 77, 4],
    [7, 0, 76, 4],
  ]
  return sequence(kit, (step, at) => {
    const barIndex = Math.floor(step / 8) % bars.length
    const cycle = Math.floor(step / 64)
    const [bass, ...chord] = bars[barIndex]
    const eighth = beat / 2

    if (step % 8 === 0) {
      note(kit, 'sawtooth', midi(bass), at, beat * 4, 0.05, { attack: 0.4, filter: 500 })
      chord.forEach((pitch) => note(kit, 'sawtooth', midi(pitch), at, beat * 4, 0.012, { attack: 0.6, filter: 1400 }))
      if (cycle > 0 || barIndex >= 4) thump(kit, at, 110, 55, 0.6, 0.18)
    }
    if (barIndex === 6 && step % 8 === 4) {
      note(kit, 'sawtooth', midi(64), at, beat * 2, 0.015, { attack: 0.2, filter: 1400 })
    }

    const arp = [chord[0], chord[1], chord[2], chord[1]][step % 4] + 12
    note(kit, 'triangle', midi(arp), at, eighth * 1.6, cycle > 0 ? 0.035 : 0.028)

    if (step % 2 === 0) {
      const position = (step % 8) / 2
      for (const [bar, start, pitch, length] of melody) {
        if (bar !== barIndex || start !== position) continue
        const brass = cycle > 0
        note(kit, brass ? 'sawtooth' : 'triangle', midi(brass ? pitch - 12 : pitch), at, beat * length, brass ? 0.04 : 0.05, {
          attack: 0.06,
          filter: brass ? 1800 : 0,
          vibrato: length >= 3 ? 3 : 0,
        })
      }
    }
    if (cycle > 0 && step % 8 === 6 && barIndex % 2 === 1) hiss(kit, 'highpass', 6000, at, 0.6, 0.02, 1, 0.2)
    return eighth
  })
}

const synths: Record<SynthId, (kit: Kit) => () => void> = { tension, interrogation, garage, jazz, sad, victory }

class Music {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private current: Playing | null = null
  private elements = new Map<string, { element: HTMLAudioElement; source: MediaElementAudioSourceNode }>()
  private missing = new Set<string>()
  private holds = new Set<string>()
  private pending: TrackId | null = null

  private boot() {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = VOLUME
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.ratio.value = 8
    this.master.connect(limiter)
    limiter.connect(ctx.destination)
    const length = ctx.sampleRate
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1

    const unlock = () => this.apply()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    document.addEventListener('visibilitychange', () => this.hold('hidden', document.hidden))
    return ctx
  }

  play(id: TrackId, restart = false) {
    if (this.current?.id === id && !restart) return
    if (!this.ctx && navigator.userActivation?.hasBeenActive === false) {
      if (this.pending === null) {
        const unlock = () => {
          window.removeEventListener('pointerdown', unlock)
          window.removeEventListener('keydown', unlock)
          const track = this.pending
          this.pending = null
          if (track) this.play(track)
        }
        window.addEventListener('pointerdown', unlock)
        window.addEventListener('keydown', unlock)
      }
      this.pending = id
      return
    }
    let ctx: AudioContext
    try {
      ctx = this.boot()
    } catch {
      return
    }
    this.fadeOut(FADE)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE)
    gain.connect(this.master!)
    const stop = this.start(id, gain)
    this.current = { id, gain, stop }
    this.apply()
  }

  keep(id: TrackId) {
    if (!this.current && !this.pending) this.play(id)
  }

  stop(fade = FADE) {
    this.pending = null
    this.fadeOut(fade)
  }

  hold(reason: string, on: boolean) {
    if (on) this.holds.add(reason)
    else this.holds.delete(reason)
    this.apply()
  }

  private synth(id: SynthId, out: GainNode) {
    const level = this.ctx!.createGain()
    level.gain.value = LEVELS[id]
    level.connect(out)
    return synths[id]({ ctx: this.ctx!, out: level, noise: this.noise! })
  }

  private start(id: TrackId, out: GainNode): () => void {
    const file = files[id]
    if (!file || this.missing.has(file.src)) return this.synth((file?.fallback ?? id) as SynthId, out)

    const { element, source } = this.element(file.src)
    source.disconnect()
    source.connect(out)
    element.currentTime = 0
    let stopFallback: (() => void) | null = null
    const onError = () => {
      this.missing.add(file.src)
      stopFallback = this.synth(file.fallback, out)
    }
    if (element.error) onError()
    else element.addEventListener('error', onError, { once: true })
    return () => {
      element.removeEventListener('error', onError)
      if (this.current?.id !== id) element.pause()
      stopFallback?.()
    }
  }

  private element(src: string) {
    let hit = this.elements.get(src)
    if (!hit) {
      const element = new Audio(import.meta.env.BASE_URL + src)
      element.loop = true
      element.preload = 'auto'
      hit = { element, source: this.ctx!.createMediaElementSource(element) }
      this.elements.set(src, hit)
    }
    return hit
  }

  private fadeOut(fade: number) {
    const playing = this.current
    if (!playing || !this.ctx) return
    this.current = null
    const now = this.ctx.currentTime
    playing.gain.gain.cancelScheduledValues(now)
    playing.gain.gain.setTargetAtTime(0.0001, now, fade / 4)
    window.setTimeout(() => {
      playing.stop()
      playing.gain.disconnect()
    }, fade * 1000 + 200)
  }

  private apply() {
    const ctx = this.ctx
    if (!ctx) return
    const paused = this.holds.size > 0
    if (paused) void ctx.suspend()
    else void ctx.resume()
    const file = this.current && files[this.current.id]
    if (!file || this.missing.has(file.src)) return
    const element = this.elements.get(file.src)?.element
    if (!element) return
    if (paused) element.pause()
    else if (element.paused) void element.play().catch(() => undefined)
  }
}

export const music = new Music()
