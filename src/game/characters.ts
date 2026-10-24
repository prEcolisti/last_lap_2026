import detectiveSheet from '../assets/characters/detective.png'
import mechanicSheet from '../assets/characters/mechanic.png'
import pilot1Sheet from '../assets/characters/pilot1.png'
import pilot22Sheet from '../assets/characters/pilot22.png'
import sponsorSheet from '../assets/characters/sponsor.png'
import mechanicFifthSheet from '../assets/cutscene/mechanic-fifth.png'
import { pixelEllipse } from './lighting.ts'

export type Direction = 'down' | 'left' | 'right' | 'up'

export const characterSheets = {
  detective: detectiveSheet,
  pilot1: pilot1Sheet,
  pilot22: pilot22Sheet,
  mechanic: mechanicSheet,
  mechanicFifth: mechanicFifthSheet,
  sponsor: sponsorSheet,
} as const

export type CharacterId = keyof typeof characterSheets

export const FRAME_SIZE = 32
const FEET_Y = 30
const ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 }
const WALK_CYCLE = [0, 1, 2, 1] as const
export const IDLE_FRAME = 1

export function walkFrame(step: number): number {
  return WALK_CYCLE[Math.floor(step) % WALK_CYCLE.length]
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  dir: Direction,
  frame: number,
  x: number,
  y: number,
) {
  const left = Math.round(x - FRAME_SIZE / 2)
  const top = Math.round(y - FEET_Y)
  pixelEllipse(ctx, Math.round(x), Math.round(y) + 1, 8, 2, 'rgba(0, 0, 0, 0.35)')
  ctx.drawImage(sheet, frame * FRAME_SIZE, ROW[dir] * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE, left, top, FRAME_SIZE, FRAME_SIZE)
}
