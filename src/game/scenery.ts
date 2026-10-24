import { cone, glow, pixelEllipse } from './lighting.ts'
import { asphalt, crowdColors, grass, kerb, lamp, metal, night } from './palette.ts'
import { H, OUTLINE, W, cached, drawNumber, fill, mix, offscreen, outline, rng } from './pixels.ts'

export { H, W, fill, rng }

export const TRACK_TOP = 118
export const TRACK_BOTTOM = 162
export const LANE_NEAR = 156
export const LANE_FAR = 136

const SKIN = '#f3e2c0'
const SKIN_SHADE = '#d9b98f'
const EYE = '#1a1d22'

function wrap(value: number, size: number) {
  return ((value % size) + size) % size
}

function drawStrip(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, offset: number, y: number) {
  for (let x = -Math.round(wrap(offset, image.width)); x < W; x += image.width) ctx.drawImage(image, x, y)
}

const FLOODLIGHTS = [40, 150, 260]

function buildSky() {
  const { canvas, ctx } = offscreen(W, 64)
  night.sky.forEach((color, i) => fill(ctx, color, 0, i * 7, W, 7))
  fill(ctx, night.sky[night.sky.length - 1], 0, 35, W, 29)
  const rand = rng(7)
  for (let i = 0; i < 34; i++) fill(ctx, rand() > 0.8 ? night.starBright : night.star, rand() * W, rand() * 28, 1, 1)

  for (const x of FLOODLIGHTS) {
    glow(ctx, x + 1, 9, 18, 9)
    const mast = offscreen(16, 40)
    fill(mast.ctx, metal.dark, 7, 8, 2, 32)
    fill(mast.ctx, metal.base, 7, 8, 1, 32)
    fill(mast.ctx, metal.base, 1, 3, 14, 5)
    fill(mast.ctx, metal.light, 1, 3, 14, 1)
    for (let i = 0; i < 3; i++) fill(mast.ctx, lamp.warm, 2 + i * 4, 5, 3, 2)
    fill(mast.ctx, lamp.core, 2, 5, 1, 1)
    outline(mast.canvas)
    ctx.drawImage(mast.canvas, x - 7, 2)
  }
  return canvas
}

export function drawSky(ctx: CanvasRenderingContext2D) {
  ctx.drawImage(cached('sky', buildSky), 0, 0)
}

export interface StandsOptions {
  sponsorInBox: boolean
  crowd: boolean
}

export const STANDS_WIDTH = 640
const STANDS_HEIGHT = 80
export const VIP_X = 430
const VIP_W = 82
const VIP_SEATS = 5

function guest(ctx: CanvasRenderingContext2D, x: number, y: number, hair: string, suit: string) {
  const { canvas, ctx: g } = offscreen(10, 13)
  fill(g, hair, 2, 1, 6, 2)
  fill(g, SKIN, 2, 3, 6, 4)
  fill(g, SKIN_SHADE, 7, 4, 1, 3)
  fill(g, hair, 1, 2, 1, 3)
  fill(g, EYE, 3, 4, 1, 2)
  fill(g, EYE, 6, 4, 1, 2)
  fill(g, suit, 1, 7, 8, 5)
  fill(g, mix(suit, '#ffffff', 0.18), 1, 7, 3, 1)
  outline(canvas)
  ctx.drawImage(canvas, x - 1, y - 1)
}

function sponsor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const { canvas, ctx: g } = offscreen(10, 13)
  fill(g, SKIN, 2, 1, 6, 6)
  fill(g, '#fff8e6', 3, 1, 2, 1)
  fill(g, '#c8ced0', 1, 3, 1, 3)
  fill(g, '#c8ced0', 8, 3, 1, 3)
  fill(g, SKIN_SHADE, 7, 4, 1, 3)
  fill(g, '#c9a227', 2, 4, 6, 1)
  fill(g, EYE, 3, 5, 1, 1)
  fill(g, EYE, 6, 5, 1, 1)
  fill(g, '#2a2f36', 1, 7, 8, 5)
  fill(g, '#3e4550', 1, 7, 3, 1)
  fill(g, '#e8ece9', 4, 7, 2, 2)
  fill(g, '#d93a3a', 4, 8, 2, 3)
  outline(canvas)
  ctx.drawImage(canvas, x - 1, y - 1)
}

function buildStands({ sponsorInBox, crowd }: StandsOptions) {
  const { canvas, ctx } = offscreen(STANDS_WIDTH, STANDS_HEIGHT)
  const rand = rng(crowd ? 42 : 43)

  fill(ctx, metal.dark, 0, 0, STANDS_WIDTH, 6)
  fill(ctx, metal.base, 0, 0, STANDS_WIDTH, 1)
  fill(ctx, OUTLINE, 0, 6, STANDS_WIDTH, 1)
  fill(ctx, '#0e1316', 0, 7, STANDS_WIDTH, 3)

  for (let row = 0; row < 8; row++) {
    const y = 10 + row * 7
    const dim = row < 3 ? 0.62 : row < 6 ? 0.42 : 0.22
    fill(ctx, mix(row % 2 ? '#1a2328' : '#1e282e', OUTLINE, dim), 0, y, STANDS_WIDTH, 7)
    fill(ctx, mix('#2c3840', OUTLINE, dim), 0, y + 6, STANDS_WIDTH, 1)
    for (let x = 1; x < STANDS_WIDTH; x += 5) {
      if (x > VIP_X - 10 && x < VIP_X + VIP_W + 4 && row < 7) continue
      if (!crowd || rand() < 0.2) continue
      const shirt = crowdColors[Math.floor(rand() * crowdColors.length)]
      const hair = ['#3a2618', '#1c1618', '#c9a04a', '#5a3a22'][Math.floor(rand() * 4)]
      fill(ctx, mix(hair, OUTLINE, dim), x, y + 1, 3, 1)
      fill(ctx, mix(SKIN_SHADE, OUTLINE, dim), x, y + 2, 3, 2)
      fill(ctx, mix(shirt, OUTLINE, dim), x, y + 4, 4, 2)
    }
  }

  for (let x = 30; x < STANDS_WIDTH; x += 64) {
    fill(ctx, OUTLINE, x - 1, 7, 5, 59)
    fill(ctx, metal.base, x, 7, 3, 58)
    fill(ctx, metal.light, x, 7, 1, 58)
  }

  const vx = VIP_X - 8
  fill(ctx, OUTLINE, vx - 1, 9, VIP_W + 2, 50)
  fill(ctx, metal.base, vx, 10, VIP_W, 48)
  fill(ctx, metal.light, vx, 10, VIP_W, 1)
  fill(ctx, '#2a241c', vx + 3, 14, VIP_W - 6, 36)
  fill(ctx, '#3a3026', vx + 3, 14, VIP_W - 6, 20)
  fill(ctx, '#c9a227', vx + VIP_W / 2 - 9, 11, 18, 2)
  for (let i = 0; i < VIP_SEATS; i++) {
    const lx = vx + 9 + i * 15
    fill(ctx, metal.dark, lx, 14, 6, 2)
    fill(ctx, lamp.warm, lx + 1, 16, 4, 1)
    glow(ctx, lx + 3, 30, 9, 14)
  }

  for (let i = 0; i < VIP_SEATS; i++) {
    const sx = vx + 7 + i * 15
    const isSponsorSeat = i === 2
    const seated = crowd && (!isSponsorSeat || sponsorInBox)
    fill(ctx, OUTLINE, sx - 1, 33, 12, 15)
    fill(ctx, '#7a1f24', sx, 34, 10, 13)
    fill(ctx, '#a8343a', sx, 34, 10, 2)
    fill(ctx, '#5a161a', sx + 8, 36, 2, 11)
    if (seated) {
      if (isSponsorSeat) sponsor(ctx, sx + 1, 29)
      else guest(ctx, sx + 1, 29, ['#3a2618', '#c9a04a', '#1c1618', '#5a3a22', '#c8ced0'][i], i % 2 ? '#3e4550' : '#2a2f36')
    }
  }
  fill(ctx, metal.base, vx + 3, 46, VIP_W - 6, 4)
  fill(ctx, metal.light, vx + 3, 46, VIP_W - 6, 1)

  ctx.fillStyle = 'rgba(200, 220, 230, 0.08)'
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(vx + 10 + i, 14 + i * 2, 3, 2)
    ctx.fillRect(vx + 46 + i, 14 + i * 2, 2, 2)
  }

  fill(ctx, OUTLINE, 0, 65, STANDS_WIDTH, 1)
  fill(ctx, metal.base, 0, 66, STANDS_WIDTH, 14)
  fill(ctx, metal.light, 0, 66, STANDS_WIDTH, 1)
  for (let x = 12; x < STANDS_WIDTH; x += 96) {
    fill(ctx, OUTLINE, x - 1, 68, 42, 10)
    fill(ctx, '#1f4a35', x, 69, 40, 8)
    fill(ctx, '#3dbf72', x + 4, 71, 18, 2)
    fill(ctx, '#2a8a52', x + 4, 74, 26, 1)
  }
  return canvas
}

export function standsCanvas(options: StandsOptions) {
  return cached(`stands-${options.sponsorInBox}-${options.crowd}`, () => buildStands(options))
}

function buildBarrier() {
  const { canvas, ctx } = offscreen(128, 16)
  fill(ctx, '#151b20', 0, 0, 128, 16)
  const rail = (y: number) => {
    fill(ctx, OUTLINE, 0, y - 1, 128, 1)
    fill(ctx, metal.shine, 0, y, 128, 1)
    fill(ctx, metal.lighter, 0, y + 1, 128, 1)
    fill(ctx, metal.base, 0, y + 2, 128, 1)
    fill(ctx, OUTLINE, 0, y + 3, 128, 1)
  }
  rail(2)
  rail(9)
  for (let x = 6; x < 128; x += 16) {
    fill(ctx, OUTLINE, x - 1, 0, 4, 16)
    fill(ctx, metal.base, x, 0, 2, 16)
    fill(ctx, metal.light, x, 0, 1, 16)
  }
  fill(ctx, OUTLINE, 0, 15, 128, 1)
  return canvas
}

function buildAsphalt() {
  const height = TRACK_BOTTOM - TRACK_TOP + 18
  const { canvas, ctx } = offscreen(64, height)
  const rand = rng(11)
  const road = TRACK_BOTTOM - TRACK_TOP
  fill(ctx, asphalt.base, 0, 0, 64, road)
  fill(ctx, asphalt.dark, 0, 0, 64, 2)
  for (let i = 0; i < 70; i++) fill(ctx, rand() > 0.5 ? asphalt.light : asphalt.dark, rand() * 64, 2 + rand() * (road - 3), 2, 1)
  fill(ctx, asphalt.line, 8, 22, 18, 1)

  fill(ctx, OUTLINE, 0, road, 64, 1)
  for (let x = 0; x < 64; x += 16) {
    fill(ctx, kerb.red, x, road + 1, 8, 3)
    fill(ctx, kerb.white, x + 8, road + 1, 8, 3)
  }
  fill(ctx, OUTLINE, 0, road + 4, 64, 1)
  fill(ctx, grass.base, 0, road + 5, 64, height - road - 5)
  for (let i = 0; i < 26; i++) fill(ctx, rand() > 0.5 ? grass.light : grass.dark, rand() * 64, road + 5 + rand() * 12, 1, 2)
  return canvas
}

function buildReflections() {
  const { canvas, ctx } = offscreen(W, TRACK_BOTTOM - TRACK_TOP)
  for (const x of FLOODLIGHTS) {
    for (let y = 2; y < TRACK_BOTTOM - TRACK_TOP - 2; y++) {
      if (y % 4 === 3) continue
      ctx.fillStyle = 'rgba(246, 231, 176, 0.05)'
      ctx.fillRect(x - 4, y, 10, 1)
      ctx.fillStyle = 'rgba(246, 231, 176, 0.08)'
      ctx.fillRect(x - 1, y, 4, 1)
    }
  }
  return canvas
}

function buildFloodCones() {
  const { canvas, ctx } = offscreen(W, H)
  for (const x of FLOODLIGHTS) cone(ctx, x + 1, 10, TRACK_BOTTOM, 34)
  return canvas
}

export interface SideTrackOptions {
  scroll: number
  stands: StandsOptions
}

export function drawSideTrack(ctx: CanvasRenderingContext2D, { scroll, stands }: SideTrackOptions) {
  drawSky(ctx)
  drawStrip(ctx, standsCanvas(stands), scroll * 0.35, 34)
  drawStrip(ctx, cached('barrier', buildBarrier), scroll, TRACK_TOP - 16)
  drawStrip(ctx, cached('asphalt', buildAsphalt), scroll, TRACK_TOP)
  ctx.drawImage(cached('reflections', buildReflections), 0, TRACK_TOP)
  ctx.drawImage(cached('flood-cones', buildFloodCones), 0, 0)
}

export function carShadow(ctx: CanvasRenderingContext2D, x: number, lane: number) {
  pixelEllipse(ctx, x + 36, lane, 34, 2, 'rgba(0, 0, 0, 0.35)')
}

export function drawTyreWall(ctx: CanvasRenderingContext2D, x: number, dented: boolean) {
  const wall = cached(`tyres-${dented}`, () => {
    const built = offscreen(46, 24)
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const tx = 1 + i * 10 + (row % 2) * 4 - (dented && i > 1 ? 2 : 0)
        const ty = 16 - row * 7 + (dented && i === 2 && row === 2 ? 2 : 0)
        fill(built.ctx, '#1a1d22', tx, ty, 9, 6)
        fill(built.ctx, '#3a4048', tx, ty, 9, 1)
        fill(built.ctx, row === 1 ? kerb.red : kerb.white, tx + 1, ty + 3, 7, 1)
      }
    }
    return outline(built.canvas)
  })
  ctx.drawImage(wall, x, TRACK_TOP - 22)
}

export function drawFinishLine(ctx: CanvasRenderingContext2D, x: number) {
  for (let y = TRACK_TOP; y < TRACK_BOTTOM; y += 4) {
    const odd = ((y - TRACK_TOP) / 4) % 2
    fill(ctx, odd ? '#c9d0d2' : '#141a1e', x, y, 4, 4)
    fill(ctx, odd ? '#141a1e' : '#c9d0d2', x + 4, y, 4, 4)
  }
  const arch = cached('finish-arch', () => {
    const built = offscreen(26, 56)
    fill(built.ctx, metal.base, 2, 8, 3, 48)
    fill(built.ctx, metal.light, 2, 8, 1, 48)
    fill(built.ctx, metal.base, 20, 8, 3, 48)
    fill(built.ctx, metal.light, 20, 8, 1, 48)
    for (let i = 0; i < 12; i++) {
      fill(built.ctx, i % 2 ? '#c9d0d2' : '#141a1e', 1 + i * 2, 1, 2, 3)
      fill(built.ctx, i % 2 ? '#141a1e' : '#c9d0d2', 1 + i * 2, 4, 2, 3)
    }
    return outline(built.canvas)
  })
  ctx.drawImage(arch, x - 9, TRACK_TOP - 50)
}

export const OVAL = { cx: 160, cy: 96, rx: 118, ry: 56 }

export function ovalPoint(angle: number) {
  return {
    x: Math.round(OVAL.cx + Math.cos(angle) * OVAL.rx),
    y: Math.round(OVAL.cy + Math.sin(angle) * OVAL.ry),
  }
}

function buildTopTrack() {
  const { canvas, ctx } = offscreen(W, H)
  const image = ctx.createImageData(W, H)
  const rand = rng(3)
  const put = (x: number, y: number, color: string) => {
    const value = parseInt(color.slice(1), 16)
    const o = (y * W + x) * 4
    image.data[o] = value >> 16
    image.data[o + 1] = (value >> 8) & 255
    image.data[o + 2] = value & 255
    image.data[o + 3] = 255
  }
  const { cx, cy, rx, ry } = OVAL
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry
      const f = nx * nx + ny * ny - 1
      const gradient = 2 * Math.hypot(nx / rx, ny / ry)
      const d = f / gradient
      const angle = Math.atan2(ny, nx)
      const noise = rand()
      let color = noise > 0.92 ? grass.light : noise < 0.08 ? grass.dark : grass.base
      if (Math.abs(d) < 7) color = noise > 0.9 ? asphalt.light : noise < 0.1 ? asphalt.dark : asphalt.base
      if (Math.abs(d) >= 7 && Math.abs(d) < 9) color = Math.floor(((angle + Math.PI) * 60) / Math.PI) % 2 ? kerb.red : kerb.white
      if (Math.abs(d) >= 9 && Math.abs(d) < 10) color = OUTLINE
      if (Math.abs(d) < 0.5 && Math.floor(((angle + Math.PI) * 40) / Math.PI) % 2) color = asphalt.line
      put(x, y, color)
    }
  }
  ctx.putImageData(image, 0, 0)

  fill(ctx, OUTLINE, 89, 9, 142, 22)
  for (let y = 10; y < 30; y += 2) {
    fill(ctx, '#181f25', 90, y, 140, 1)
    fill(ctx, '#232b32', 90, y + 1, 140, 1)
  }
  fill(ctx, '#2b333b', 90, 10, 140, 1)
  fill(ctx, '#c9a227', 150, 30, 20, 1)

  fill(ctx, OUTLINE, 99, 161, 122, 14)
  fill(ctx, metal.base, 100, 162, 120, 12)
  fill(ctx, metal.light, 100, 162, 120, 1)
  for (let x = 104; x < 216; x += 12) {
    fill(ctx, '#151b20', x, 166, 9, 7)
    fill(ctx, lamp.amber, x + 2, 166, 5, 1)
  }

  for (let y = 143; y < 158; y += 2) {
    fill(ctx, '#c9d0d2', 160, y, 2, 2)
    fill(ctx, '#141a1e', 162, y, 2, 2)
  }

  const trees = rng(5)
  for (const [tx, ty] of [[12, 14], [26, 8], [300, 16], [288, 30], [10, 160], [306, 150], [296, 166]]) {
    const r = 6 + Math.round(trees() * 3)
    pixelEllipse(ctx, tx, ty, r + 1, r + 1, OUTLINE)
    pixelEllipse(ctx, tx, ty, r, r, '#0f1d17')
    pixelEllipse(ctx, tx - 2, ty - 2, r - 3, r - 3, '#16271f')
  }

  for (const [lx, ly] of [[60, 40], [260, 40], [60, 150], [260, 150]]) {
    glow(ctx, lx, ly, 34, 22)
    fill(ctx, OUTLINE, lx - 2, ly - 2, 5, 5)
    fill(ctx, lamp.warm, lx - 1, ly - 1, 3, 3)
  }
  return canvas
}

export function drawTopTrack(ctx: CanvasRenderingContext2D) {
  ctx.drawImage(cached('top-track', buildTopTrack), 0, 0)
}

const PIT_LAMPS = [40, 120, 200, 280]

function buildPitBox() {
  const { canvas, ctx } = offscreen(W, H)
  fill(ctx, '#0c1114', 0, 0, W, 16)
  fill(ctx, '#1a2228', 0, 16, W, 100)
  for (let x = 0; x < W; x += 40) {
    fill(ctx, '#151c21', x, 16, 1, 100)
    fill(ctx, '#202a31', x + 1, 16, 1, 100)
  }
  fill(ctx, metal.dark, 0, 14, W, 3)
  fill(ctx, OUTLINE, 0, 17, W, 1)

  fill(ctx, OUTLINE, 127, 25, 66, 29)
  fill(ctx, '#c62a2f', 128, 26, 64, 27)
  fill(ctx, '#e04848', 128, 26, 64, 1)
  fill(ctx, '#8f1f24', 128, 52, 64, 1)
  drawNumber(ctx, '7', 154, 29, '#f2f2f2', 4)

  for (const x of [14, 266]) {
    fill(ctx, OUTLINE, x - 1, 39, 42, 28)
    fill(ctx, metal.base, x, 40, 40, 26)
    for (let py = 43; py < 64; py += 4) for (let px = x + 2; px < x + 40; px += 4) fill(ctx, metal.dark, px, py, 1, 1)
    fill(ctx, metal.shine, x + 5, 44, 2, 12)
    fill(ctx, metal.shine, x + 4, 44, 4, 2)
    fill(ctx, '#c62a2f', x + 13, 46, 7, 4)
    fill(ctx, metal.dark, x + 15, 50, 3, 8)
    fill(ctx, '#e8c43a', x + 26, 44, 3, 10)
    fill(ctx, metal.shine, x + 33, 45, 2, 14)

    fill(ctx, OUTLINE, x - 1, 79, 42, 38)
    fill(ctx, '#8f1f24', x, 80, 40, 36)
    fill(ctx, '#c62a2f', x, 80, 40, 2)
    for (let dy = 86; dy < 114; dy += 7) {
      fill(ctx, '#6f2020', x + 2, dy, 36, 1)
      fill(ctx, metal.shine, x + 16, dy + 3, 8, 1)
    }
    fill(ctx, metal.light, x - 1, 78, 42, 1)
  }

  fill(ctx, OUTLINE, 213, 29, 41, 43)
  fill(ctx, '#d8dcd4', 214, 30, 39, 41)
  fill(ctx, '#b8bdb5', 252, 31, 1, 40)
  fill(ctx, '#b8bdb5', 215, 70, 38, 1)
  fill(ctx, '#c62a2f', 214, 30, 39, 4)
  fill(ctx, OUTLINE, 232, 27, 3, 3)
  for (let row = 0; row < 4; row++) {
    const y = 39 + row * 8
    fill(ctx, metal.lighter, 217, y, 14, 1)
    fill(ctx, metal.lighter, 217, y + 2, 10, 1)
    const sign = [0, -1, 1, 0, -1, 1, 1, -1, 0, 1]
    sign.forEach((dy, i) => fill(ctx, '#3d5a8f', 235 + i, y + 1 + dy, 1, 1))
  }

  for (const x of [64, 240]) {
    const stack = offscreen(18, 30)
    for (let i = 0; i < 4; i++) {
      fill(stack.ctx, '#1a1d22', 1, 1 + i * 7, 16, 6)
      fill(stack.ctx, '#3a4048', 1, 1 + i * 7, 16, 1)
      fill(stack.ctx, '#e8c43a', 3, 4 + i * 7, 12, 1)
    }
    outline(stack.canvas)
    ctx.drawImage(stack.canvas, x, 87)
  }

  fill(ctx, '#20272d', 0, 116, W, 64)
  fill(ctx, '#c9a227', 0, 116, W, 2)
  fill(ctx, OUTLINE, 0, 118, W, 1)
  for (let x = 0; x < W; x += 24) fill(ctx, '#2c343b', x, 162, 12, 2)

  for (const x of PIT_LAMPS) {
    cone(ctx, x, 18, 150, 26)
    glow(ctx, x, 150, 34, 8)
    fill(ctx, OUTLINE, x - 13, 16, 26, 5)
    fill(ctx, metal.base, x - 12, 16, 24, 3)
    fill(ctx, lamp.warm, x - 10, 19, 20, 1)
    fill(ctx, lamp.core, x - 10, 19, 4, 1)
  }
  return canvas
}

export function drawPitBox(ctx: CanvasRenderingContext2D) {
  ctx.drawImage(cached('pit-box', buildPitBox), 0, 0)
}

export const MONITORS = [
  { x: 14, y: 26 },
  { x: 226, y: 26 },
]
const MONITOR_W = 80
const MONITOR_H = 56

function buildPitWall() {
  const { canvas, ctx } = offscreen(W, H)
  night.sky.forEach((color, i) => fill(ctx, color, 0, i * 10, W, 10))
  fill(ctx, night.sky[4], 0, 50, W, 70)
  fill(ctx, '#0b1114', 0, 58, W, 18)
  const rand = rng(21)
  for (let i = 0; i < 40; i++) fill(ctx, rand() > 0.7 ? lamp.amber : '#2b333b', rand() * W, 60 + rand() * 14, 1, 1)
  for (const x of [60, 160, 260]) glow(ctx, x, 46, 14, 8)
  fill(ctx, metal.dark, 0, 76, W, 4)

  for (const { x, y } of MONITORS) {
    fill(ctx, OUTLINE, x + MONITOR_W / 2 - 4, y + MONITOR_H, 8, 24)
    fill(ctx, metal.base, x + MONITOR_W / 2 - 3, y + MONITOR_H, 6, 23)
    fill(ctx, OUTLINE, x - 3, y - 3, MONITOR_W + 6, MONITOR_H + 6)
    fill(ctx, metal.base, x - 2, y - 2, MONITOR_W + 4, MONITOR_H + 4)
    fill(ctx, metal.light, x - 2, y - 2, MONITOR_W + 4, 1)
    fill(ctx, '#06100b', x, y, MONITOR_W, MONITOR_H)
    for (let gx = 0; gx < MONITOR_W; gx += 10) fill(ctx, '#0c1c14', x + gx, y, 1, MONITOR_H)
    for (let gy = 0; gy < MONITOR_H; gy += 10) fill(ctx, '#0c1c14', x, y + gy, MONITOR_W, 1)
  }

  fill(ctx, OUTLINE, 0, 103, W, 1)
  fill(ctx, metal.light, 0, 104, W, 3)
  fill(ctx, metal.shine, 0, 104, W, 1)
  fill(ctx, metal.base, 0, 107, W, 73)
  fill(ctx, OUTLINE, 0, 107, W, 1)
  for (let x = 24; x < W; x += 30) {
    fill(ctx, metal.dark, x, 116, 18, 8)
    fill(ctx, '#3dbf72', x + 2, 118, 2, 2)
    fill(ctx, '#e8c43a', x + 6, 118, 2, 2)
  }
  return canvas
}

export function drawPitWall(ctx: CanvasRenderingContext2D, telemetry: number, time: number) {
  ctx.drawImage(cached('pit-wall', buildPitWall), 0, 0)
  MONITORS.forEach(({ x, y }, i) => {
    const hot = telemetry > 0.75
    const color = hot ? '#e04848' : i === 0 ? '#3dbf72' : '#e0a92e'
    fill(ctx, color, x + 2, y + 2, 14, 2)
    for (let gx = 0; gx < MONITOR_W; gx += 2) {
      const base = telemetry * (gx / MONITOR_W) + (i === 1 ? 0.15 : 0)
      const value = base + Math.sin((gx + time * 30 + i * 20) / 6) * 0.04
      const gy = y + MONITOR_H - 4 - Math.round(Math.min(1, Math.max(0, value)) * (MONITOR_H - 12))
      fill(ctx, color, x + gx, gy, 2, 1)
    }
    if (hot && Math.floor(time * 3) % 2) fill(ctx, '#e04848', x + MONITOR_W - 10, y + 3, 6, 6)
  })
}

export function drawStartLights(ctx: CanvasRenderingContext2D, x: number, y: number, lit: number) {
  const gantry = cached('start-gantry', () => {
    const built = offscreen(64, 40)
    fill(built.ctx, metal.base, 30, 0, 3, 22)
    fill(built.ctx, metal.light, 30, 0, 1, 22)
    fill(built.ctx, metal.dark, 0, 20, 64, 16)
    fill(built.ctx, metal.base, 0, 20, 64, 1)
    for (let i = 0; i < 5; i++) {
      fill(built.ctx, OUTLINE, 3 + i * 12, 23, 10, 11)
      fill(built.ctx, '#2a1415', 4 + i * 12, 24, 8, 4)
      fill(built.ctx, '#2a1415', 4 + i * 12, 29, 8, 4)
    }
    return outline(built.canvas)
  })
  ctx.drawImage(gantry, x, y - 20)
  for (let i = 0; i < lit; i++) {
    const lx = x + 4 + i * 12
    pixelEllipse(ctx, lx + 4, y + 8, 9, 8, 'rgba(224, 72, 72, 0.12)')
    pixelEllipse(ctx, lx + 4, y + 8, 6, 5, 'rgba(224, 72, 72, 0.16)')
    fill(ctx, '#e04848', lx, y + 4, 8, 4)
    fill(ctx, '#e04848', lx, y + 9, 8, 4)
    fill(ctx, '#ff9b8f', lx + 1, y + 4, 3, 1)
    fill(ctx, '#ff9b8f', lx + 1, y + 9, 3, 1)
  }
}
