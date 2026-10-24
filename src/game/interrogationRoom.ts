import { drawCharacter, type Direction } from './characters.ts'
import { glow, pixelEllipse, vignette } from './lighting.ts'
import { metal } from './palette.ts'
import { H, OUTLINE, W, cached, drawText, fill, offscreen, outline, rng, textWidth } from './pixels.ts'
import { VIP_X, standsCanvas } from './scenery.ts'

export const WALL_BOTTOM = 58
export const FEET = 128
export const APPROACH_Y = FEET + 18
export const DOOR_X = 44
export const SUSPECT_SEAT = 94
export const DETECTIVE_SEAT = 226
const TABLE = { x: 118, y: 96, w: 84, h: 36 }
export const TABLE_TOP = TABLE.y + 24
const DOOR = { x: DOOR_X - 18, y: 4, w: 36, h: WALL_BOTTOM - 4 }

export function drawPerson(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, dir: Direction, frame: number, x: number, y: number) {
  ctx.save()
  ctx.scale(2, 2)
  drawCharacter(ctx, sheet, dir, frame, x / 2, y / 2)
  ctx.restore()
}

function buildRoom() {
  const { canvas, ctx } = offscreen(W, H)
  fill(ctx, '#161d22', 0, 0, W, WALL_BOTTOM)
  for (let x = 0; x < W; x += 32) {
    fill(ctx, '#131a1e', x, 0, 1, WALL_BOTTOM)
    fill(ctx, '#1b2328', x + 1, 0, 1, WALL_BOTTOM)
  }
  fill(ctx, metal.base, 0, WALL_BOTTOM - 4, W, 4)
  fill(ctx, metal.light, 0, WALL_BOTTOM - 4, W, 1)
  fill(ctx, OUTLINE, 0, WALL_BOTTOM, W, 1)

  fill(ctx, OUTLINE, 229, 9, 74, 38)
  fill(ctx, metal.base, 230, 10, 72, 36)
  fill(ctx, '#0a0f12', 233, 13, 66, 30)
  ctx.fillStyle = 'rgba(200, 220, 230, 0.08)'
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(240 + i, 13 + i * 2, 3, 2)
    ctx.fillRect(264 + i, 13 + i * 2, 2, 2)
  }

  fill(ctx, '#151b20', 0, WALL_BOTTOM + 1, W, H - WALL_BOTTOM)
  for (let y = WALL_BOTTOM + 12; y < H; y += 16) fill(ctx, '#12171b', 0, y, W, 1)
  for (let x = 8; x < W; x += 24) fill(ctx, '#12171b', x, WALL_BOTTOM + 1, 1, H - WALL_BOTTOM)
  const scuffs = rng(19)
  for (let i = 0; i < 24; i++) fill(ctx, '#181f24', scuffs() * W, WALL_BOTTOM + 4 + scuffs() * (H - WALL_BOTTOM - 8), 3 + scuffs() * 6, 1)

  glow(ctx, TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 110, 60)
  glow(ctx, TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 70, 38)
  return canvas
}

export function drawRoom(ctx: CanvasRenderingContext2D, open: number) {
  ctx.drawImage(cached('interrogation-room', buildRoom), 0, 0)
  const door = DOOR
  fill(ctx, OUTLINE, door.x - 2, door.y - 2, door.w + 4, door.h + 2)
  fill(ctx, metal.light, door.x - 1, door.y - 1, door.w + 2, door.h + 1)
  fill(ctx, '#05080a', door.x, door.y, door.w, door.h)
  const leaf = Math.round(door.w * (1 - open * 0.85))
  fill(ctx, '#2a323a', door.x, door.y, leaf, door.h)
  fill(ctx, '#323b44', door.x, door.y, Math.max(1, leaf - 3), 2)
  fill(ctx, OUTLINE, door.x + leaf - 1, door.y, 1, door.h)
  if (leaf > 8) fill(ctx, metal.shine, door.x + leaf - 6, door.y + 28, 3, 2)
}

function chair(ctx: CanvasRenderingContext2D, x: number, backLeft: boolean) {
  const seat = { x: x - 11, y: FEET - 22, w: 22, h: 20 }
  pixelEllipse(ctx, x, FEET + 2, 14, 3, 'rgba(0, 0, 0, 0.35)')
  fill(ctx, OUTLINE, seat.x - 1, seat.y - 1, seat.w + 2, seat.h + 2)
  fill(ctx, '#3a2e24', seat.x, seat.y, seat.w, seat.h)
  fill(ctx, '#4a3a2c', seat.x, seat.y, seat.w, 1)
  const bx = backLeft ? seat.x - 5 : seat.x + seat.w + 1
  fill(ctx, OUTLINE, bx - 1, seat.y - 15, 6, seat.h + 16)
  fill(ctx, '#3a2e24', bx, seat.y - 14, 4, seat.h + 14)
  fill(ctx, '#4a3a2c', bx, seat.y - 14, 1, seat.h + 14)
}

function seatLip(ctx: CanvasRenderingContext2D, x: number) {
  fill(ctx, OUTLINE, x - 12, FEET - 6, 24, 9)
  fill(ctx, '#3a2e24', x - 11, FEET - 5, 22, 6)
  fill(ctx, '#4a3a2c', x - 11, FEET - 5, 22, 1)
  fill(ctx, '#2a2018', x - 11, FEET + 1, 22, 1)
}

export function drawSeated(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, dir: Direction, x: number) {
  drawPerson(ctx, sheet, dir, 1, x, FEET)
  seatLip(ctx, x)
}

export function drawChairs(ctx: CanvasRenderingContext2D) {
  chair(ctx, SUSPECT_SEAT, true)
  chair(ctx, DETECTIVE_SEAT, false)
}

export function drawTable(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = TABLE
  fill(ctx, 'rgba(0, 0, 0, 0.35)', x + 3, y + h + 4, w - 2, 4)
  fill(ctx, OUTLINE, x - 1, y - 1, w + 2, h + 7)
  fill(ctx, '#5a4a3a', x, y, w, h)
  fill(ctx, '#6b5a46', x, y, w, 1)
  fill(ctx, '#6b5a46', x, y, 1, h)
  const grain = rng(4)
  for (let i = 0; i < 14; i++) fill(ctx, '#514233', x + 3 + grain() * (w - 20), y + 3 + grain() * (h - 6), 8 + grain() * 12, 1)
  fill(ctx, '#3a2e24', x, y + h, w, 5)
  fill(ctx, OUTLINE, x, y + h, w, 1)
  for (const lx of [x + 2, x + w - 7]) {
    fill(ctx, OUTLINE, lx - 1, y + h + 5, 7, 6)
    fill(ctx, '#2a2018', lx, y + h + 5, 5, 5)
  }
}

function buildFolder() {
  const { canvas, ctx } = offscreen(36, 14)
  fill(ctx, '#f2f2f2', 3, 1, 30, 4)
  fill(ctx, '#c9a227', 1, 3, 34, 9)
  fill(ctx, '#e8c47a', 1, 3, 34, 1)
  fill(ctx, '#9a7a1e', 1, 10, 34, 2)
  fill(ctx, '#c62a2f', 14, 5, 9, 3)
  return outline(canvas)
}

export function drawFolder(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const folder = cached('case-folder', buildFolder)
  ctx.drawImage(folder, Math.round(x - folder.width / 2), Math.round(y - folder.height))
}

const STAMP_TEXT = 'ДЕЛО РАСКРЫТО'

function buildDocuments(fifth: HTMLImageElement) {
  const { canvas, ctx } = offscreen(W, H)
  fill(ctx, '#3a2e24', 0, 0, W, H)
  const grain = rng(8)
  for (let i = 0; i < 90; i++) fill(ctx, grain() > 0.5 ? '#43352a' : '#32271f', grain() * W, grain() * H, 6 + grain() * 20, 1)

  const paper = { x: 66, y: 10, w: 188, h: 164 }
  fill(ctx, 'rgba(0, 0, 0, 0.35)', paper.x + 4, paper.y + 4, paper.w, paper.h)
  fill(ctx, OUTLINE, paper.x - 1, paper.y - 1, paper.w + 2, paper.h + 2)
  fill(ctx, '#e8e2d0', paper.x, paper.y, paper.w, paper.h)
  fill(ctx, '#d4ccb6', paper.x + paper.w - 2, paper.y, 2, paper.h)
  fill(ctx, '#d4ccb6', paper.x, paper.y + paper.h - 2, paper.w, 2)

  const header = 'ДЕЛО №7'
  drawText(ctx, header, Math.round(W / 2 - textWidth(header)), paper.y + 8, '#2a2f36', 2)
  fill(ctx, '#c62a2f', paper.x + 12, paper.y + 22, paper.w - 24, 1)

  const photos = [
    { x: paper.x + 14, y: paper.y + 30 },
    { x: paper.x + 100, y: paper.y + 30 },
  ]
  for (const p of photos) {
    fill(ctx, OUTLINE, p.x - 1, p.y - 1, 76, 52)
    fill(ctx, '#f2f2f2', p.x, p.y, 74, 50)
  }
  const stands = standsCanvas({ sponsorInBox: false, crowd: true })
  ctx.drawImage(stands, VIP_X - 12, 8, 70, 42, photos[0].x + 2, photos[0].y + 2, 70, 42)
  fill(ctx, '#0d1418', photos[1].x + 2, photos[1].y + 2, 70, 42)
  ctx.drawImage(fifth, 32, 0, 32, 32, photos[1].x + 21, photos[1].y + 4, 32, 32)
  const seat = { x: photos[0].x + 40, y: photos[0].y + 25, w: 16, h: 19 }
  fill(ctx, '#e04848', seat.x, seat.y, seat.w, 1)
  fill(ctx, '#e04848', seat.x, seat.y + seat.h - 1, seat.w, 1)
  fill(ctx, '#e04848', seat.x, seat.y, 1, seat.h)
  fill(ctx, '#e04848', seat.x + seat.w - 1, seat.y, 1, seat.h)
  for (const p of photos) fill(ctx, metal.shine, p.x + 30, p.y - 3, 12, 3)

  const lines = rng(3)
  for (let row = 0; row < 7; row++) {
    const y = paper.y + 92 + row * 8
    fill(ctx, '#8a8f8c', paper.x + 14, y, 40 + Math.round(lines() * 120), 1)
    fill(ctx, '#a9ada6', paper.x + 14, y + 2, 30 + Math.round(lines() * 90), 1)
  }
  return canvas
}

function buildStamp() {
  const width = textWidth(STAMP_TEXT) * 2 + 14
  const { canvas, ctx } = offscreen(width, 26)
  const ink = '#c62a2f'
  fill(ctx, ink, 0, 0, width, 2)
  fill(ctx, ink, 0, 24, width, 2)
  fill(ctx, ink, 0, 0, 2, 26)
  fill(ctx, ink, width - 2, 0, 2, 26)
  fill(ctx, ink, 3, 3, width - 6, 1)
  fill(ctx, ink, 3, 22, width - 6, 1)
  drawText(ctx, STAMP_TEXT, 7, 8, ink, 2)
  const holes = rng(13)
  ctx.clearRect(0, 0, 0, 0)
  for (let i = 0; i < 70; i++) ctx.clearRect(Math.floor(holes() * width), Math.floor(holes() * 26), 1, 1)
  return canvas
}

export function drawDocuments(ctx: CanvasRenderingContext2D, fifth: HTMLImageElement, stamp: number) {
  ctx.drawImage(cached('case-documents', () => buildDocuments(fifth)), 0, 0)
  const print = cached('case-stamp', buildStamp)
  const x = Math.round(W / 2 - print.width / 2)
  const y = 124
  if (stamp >= 1) {
    ctx.drawImage(print, x, y)
  } else if (stamp > 0) {
    const grow = Math.round((1 - stamp) * 14)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(x - grow, y - grow, print.width + grow * 2, 26 + grow * 2)
  }
  vignette(ctx)
}
