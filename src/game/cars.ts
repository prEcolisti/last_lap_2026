import { OUTLINE, cached, drawNumber, fill, mix, offscreen, outline, rng } from './pixels.ts'

export interface Livery {
  number: number
  A: string
  C: string
  H: string
}

export const liveries = {
  car7: { number: 7, A: '#c62a2f', C: '#f2f2f2', H: '#f2d24b' },
  car22: { number: 22, A: '#1d3a78', C: '#e8c43a', H: '#e8ece9' },
  car3: { number: 3, A: '#e07b2e', C: '#2a2f36', H: '#2a2f36' },
  car9: { number: 9, A: '#8a9299', C: '#1a1d22', H: '#d93a3a' },
  car14: { number: 14, A: '#7a4bb0', C: '#e8ece9', H: '#e8ece9' },
  car31: { number: 31, A: '#e8ece9', C: '#3dbf72', H: '#3dbf72' },
} satisfies Record<string, Livery>

export type CarId = keyof typeof liveries

export const CAR_W = 72
export const CAR_H = 24

const CARBON = '#2a2f36'
const TYRE = '#1a1d22'
const TYRE_LIGHT = '#3a4048'
const RIM = '#8a96a0'
const RIM_DARK = '#5c6873'
const VISOR = '#1a1d22'
const GLINT = '#c8ced0'
const CHAR = '#2a2420'
const CHAR_LIGHT = '#3e342c'

const tone = (color: string) => ({
  base: color,
  light: mix(color, '#ffffff', 0.25),
  shade: mix(color, OUTLINE, 0.35),
})

function wheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  for (let dy = -7; dy <= 7; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      const d = Math.hypot(dx, dy)
      if (d > 7.4) continue
      let color = RIM
      if (d > 6.4) color = OUTLINE
      else if (d > 3.6) color = dx < 0 && dy < 0 && d > 5.3 ? TYRE_LIGHT : TYRE
      else if (d > 2.7) color = RIM_DARK
      else if (d < 1) color = CARBON
      fill(ctx, color, cx + dx, cy + dy, 1, 1)
    }
  }
  const spokes = frame % 2 ? [[2, 2], [-2, 2], [2, -2], [-2, -2]] : [[0, 2], [0, -2], [2, 0], [-2, 0]]
  for (const [sx, sy] of spokes) fill(ctx, RIM_DARK, cx + sx, cy + sy, 1, 1)
  fill(ctx, '#c8ced0', cx - 2, cy - 2, 1, 1)
}

interface BodyOptions {
  livery: Livery
  wrecked: boolean
}

function body(ctx: CanvasRenderingContext2D, { livery, wrecked }: BodyOptions) {
  const a = tone(livery.A)
  const c = tone(livery.C)
  const h = tone(livery.H)
  const cover = wrecked ? { base: CHAR, light: CHAR_LIGHT, shade: OUTLINE } : a

  if (wrecked) {
    fill(ctx, c.base, 1, 5, 2, 8)
    fill(ctx, a.shade, 3, 3, 4, 2)
    fill(ctx, a.base, 6, 5, 3, 2)
  } else {
    fill(ctx, c.base, 1, 2, 2, 11)
    fill(ctx, c.light, 1, 2, 1, 4)
    fill(ctx, a.base, 3, 2, 7, 3)
    fill(ctx, a.light, 3, 2, 7, 1)
    fill(ctx, a.shade, 3, 4, 7, 1)
  }
  fill(ctx, CARBON, 6, 5, 2, 7)

  fill(ctx, a.shade, 8, 11, 9, 6)
  fill(ctx, CARBON, 8, 17, 50, 1)

  fill(ctx, cover.base, 14, 9, 20, 2)
  fill(ctx, cover.light, 14, 9, 6, 1)
  fill(ctx, cover.base, 20, 7, 13, 2)
  fill(ctx, cover.light, 20, 7, 5, 1)
  fill(ctx, cover.base, 25, 5, 7, 2)
  fill(ctx, cover.light, 25, 5, 6, 1)
  fill(ctx, VISOR, 31, 5, 1, 3)

  fill(ctx, a.base, 12, 11, 43, 6)
  fill(ctx, a.light, 12, 11, 20, 1)
  fill(ctx, a.shade, 12, 16, 43, 1)
  fill(ctx, c.base, 16, 13, 33, 1)

  fill(ctx, CARBON, 33, 11, 10, 1)
  if (wrecked) {
    fill(ctx, OUTLINE, 34, 9, 7, 2)
  } else {
    fill(ctx, h.base, 34, 6, 7, 5)
    fill(ctx, h.light, 34, 6, 3, 1)
    fill(ctx, h.shade, 39, 10, 2, 1)
    fill(ctx, VISOR, 38, 8, 3, 2)
    fill(ctx, GLINT, 39, 8, 1, 1)
  }
  fill(ctx, CARBON, 33, 5, 9, 1)
  fill(ctx, CARBON, 42, 5, 1, 6)

  fill(ctx, a.base, 55, 12, 6, 4)
  fill(ctx, a.light, 55, 12, 6, 1)
  fill(ctx, a.base, 61, 13, 6, 3)
  fill(ctx, a.light, 61, 13, 6, 1)
  fill(ctx, a.shade, 55, 15, 12, 1)
  if (!wrecked) {
    fill(ctx, a.base, 67, 14, 3, 2)
    fill(ctx, c.base, 68, 14, 2, 2)
  }

  if (wrecked) {
    const rand = rng(7)
    for (let i = 0; i < 14; i++) {
      fill(ctx, rand() > 0.6 ? '#e07b2e' : '#e8c43a', 15 + rand() * 18, 6 + rand() * 6, 1, 1)
    }
    fill(ctx, CHAR, 44, 11, 6, 2)
    fill(ctx, OUTLINE, 58, 12, 1, 4)
    fill(ctx, OUTLINE, 52, 14, 3, 1)
  }

  drawNumber(ctx, String(livery.number), 23, 11, c.base)
}

function buildCar(livery: Livery, frame: number) {
  const { canvas, ctx } = offscreen(CAR_W, CAR_H)
  body(ctx, { livery, wrecked: false })
  wheel(ctx, 12, 15, frame)
  wheel(ctx, 52, 15, frame)
  const c = tone(livery.C)
  fill(ctx, c.base, 58, 18, 13, 2)
  fill(ctx, c.light, 58, 18, 13, 1)
  fill(ctx, c.base, 69, 15, 2, 5)
  fill(ctx, CARBON, 62, 16, 1, 2)
  return outline(canvas)
}

export function carSprite(id: CarId, frame = 0) {
  return cached(`car-${id}-${frame % 2}`, () => buildCar(liveries[id], frame % 2))
}

export const WRECK_W = 104
export const WRECK_H = 26

function buildWreck() {
  const livery = liveries.car7
  const { canvas, ctx } = offscreen(WRECK_W, WRECK_H)

  const part = offscreen(CAR_W, CAR_H)
  body(part.ctx, { livery, wrecked: true })
  wheel(part.ctx, 12, 15, 0)
  for (let x = 0; x < CAR_W; x++) {
    const drop = x > 40 ? Math.min(5, Math.floor((x - 40) / 6)) : 0
    ctx.drawImage(part.canvas, x, 0, 1, CAR_H, x, 2 + drop, 1, CAR_H)
  }
  fill(ctx, CARBON, 50, 19, 6, 1)

  const c = tone(livery.C)
  fill(ctx, c.base, 72, 22, 11, 2)
  fill(ctx, c.light, 72, 22, 11, 1)
  fill(ctx, c.base, 81, 19, 2, 3)

  wheel(ctx, 94, 17, 1)
  return outline(canvas)
}

export function wreckSprite() {
  return cached('wreck', buildWreck)
}

export type Heading = 'right' | 'left' | 'down' | 'up'

export function topCarSprite(id: CarId, heading: Heading) {
  return cached(`top-${id}-${heading}`, () => {
    const livery = liveries[id]
    const flat = offscreen(9, 6)
    fill(flat.ctx, livery.C, 1, 1, 1, 4)
    fill(flat.ctx, livery.A, 2, 1, 5, 4)
    fill(flat.ctx, mix(livery.A, '#ffffff', 0.25), 2, 1, 5, 1)
    fill(flat.ctx, livery.H, 4, 2, 2, 2)
    fill(flat.ctx, livery.C, 7, 2, 1, 2)
    outline(flat.canvas)
    if (heading === 'right') return flat.canvas
    const vertical = heading === 'up' || heading === 'down'
    const { canvas, ctx } = offscreen(vertical ? 6 : 9, vertical ? 9 : 6)
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate({ left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2 }[heading])
    ctx.drawImage(flat.canvas, -4.5, -3)
    return canvas
  })
}
