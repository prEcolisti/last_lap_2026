import { warmGlow } from './palette.ts'
import { H, W, cached, offscreen } from './pixels.ts'

export function pixelEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)))
    if (half > 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1)
  }
}

export function glow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, steps = warmGlow) {
  steps.forEach((color, i) => {
    const k = 1 - i / (steps.length + 0.5)
    pixelEllipse(ctx, cx, cy, Math.max(1, Math.round(rx * k)), Math.max(1, Math.round(ry * k)), color)
  })
}

export function cone(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, spread: number) {
  const layers = [
    { width: 1, color: warmGlow[0] },
    { width: 0.55, color: warmGlow[0] },
  ]
  for (const { width, color } of layers) {
    ctx.fillStyle = color
    for (let y = top; y < bottom; y++) {
      const half = Math.round(2 + ((y - top) / (bottom - top)) * spread * width)
      ctx.fillRect(x - half, y, half * 2, 1)
    }
  }
}

function buildVignette() {
  const { canvas, ctx } = offscreen(W, H)
  const image = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - W / 2) / (W / 2)
      const ny = (y + 0.5 - H / 2) / (H / 2)
      const d = Math.sqrt(nx * nx * 0.8 + ny * ny)
      const alpha = d > 1.18 ? 0.5 : d > 1.02 ? 0.34 : d > 0.86 ? 0.18 : 0
      const o = (y * W + x) * 4
      image.data[o] = 4
      image.data[o + 1] = 7
      image.data[o + 2] = 9
      image.data[o + 3] = Math.round(alpha * 255)
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export function vignette(ctx: CanvasRenderingContext2D) {
  ctx.drawImage(cached('vignette', buildVignette), 0, 0)
}
