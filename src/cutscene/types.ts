import type { GameAudio } from '../game/audio.ts'

export interface Overlay {
  caption?: { text: string; size: 'xl' | 'md' | 'sm' }
  subtitle?: { speaker?: string; text: string }
  sound?: string
  lap?: string
  hud?: { speed: number; heat: number }
  photo?: string
  dialogue?: { speaker: string; text: string; portrait: string; side: 'left' | 'right' }
}

export interface SharedLoops {
  crowd?: { stop(): void }
  wind?: { stop(): void }
  rain?: { stop(): void }
  room?: { stop(): void }
}

export interface DrawEnv {
  ctx: CanvasRenderingContext2D
  t: number
  frame: number
  reducedMotion: boolean
}

export interface Cue {
  at: number
  run(audio: GameAudio, loops: SharedLoops): void
}

export interface Scene {
  id: string
  duration: number
  draw(env: DrawEnv): void
  overlay?(t: number, playerName: string): Overlay
  cues?: Cue[]
  shake?(t: number): number
  flash?(t: number): number
}
