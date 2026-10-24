import type { Direction } from '../characters.ts'
import type { Topic } from '../dialogues.ts'
import type { TrackId } from '../music.ts'
import type { Clue } from '../story.ts'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export type LocationId = 'crash-site' | 'garage' | 'vip-box'

export interface Location {
  id: LocationId
  title: string
  lead: string
  background: string | (() => HTMLCanvasElement)
  walkable: Rect[]
  start: Point & { dir: Direction }
  clues: Clue[]
  rain: boolean
  music: TrackId
  npc?: Npc
}

export interface Npc {
  id: string
  name: string
  area: Rect
  topics: Topic<string>[]
  portraits: Record<string, string>
  idleMood: string
  sheet: string
  draw(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, time: number, talking: boolean): void
}

export function isWalkable(location: Location, x: number, y: number): boolean {
  return location.walkable.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
}

export function distanceToRect(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w))
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h))
  return Math.hypot(dx, dy)
}
