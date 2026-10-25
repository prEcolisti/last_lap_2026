interface Voice {
  type: OscillatorType
  pitch: number
}

const DETECTIVE: Voice = { type: 'square', pitch: 165 }
const VOICES: Voice[] = [
  { type: 'square', pitch: 240 },
  { type: 'triangle', pitch: 330 },
  { type: 'square', pitch: 300 },
  { type: 'triangle', pitch: 220 },
  { type: 'sawtooth', pitch: 270 },
  { type: 'triangle', pitch: 400 },
]
const GAP = 0.055
const VOLUME = 0.05
const SOUNDS = /[\p{L}\p{N}]/u

let ctx: AudioContext | null = null
let last = 0

export function voiceOf(speaker: string): Voice {
  if (speaker === 'Детектив' || speaker === 'detective') return DETECTIVE
  let hash = 0
  for (const char of speaker) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return VOICES[Math.abs(hash) % VOICES.length]
}

export function blip(voice: Voice, char: string) {
  if (!SOUNDS.test(char)) return
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  const now = ctx.currentTime
  if (now - last < GAP) return
  last = now

  const osc = ctx.createOscillator()
  osc.type = voice.type
  osc.frequency.value = voice.pitch * (0.94 + Math.random() * 0.12)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(VOLUME, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.06)
}
