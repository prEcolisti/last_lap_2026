import { CAR_H, carSprite, liveries, topCarSprite, wreckSprite, type CarId, type Heading } from '../game/cars.ts'
import { drawCharacter, IDLE_FRAME, walkFrame, type Direction } from '../game/characters.ts'
import { art } from '../game/cutsceneArt.ts'
import { vignette } from '../game/lighting.ts'
import { music } from '../game/music.ts'
import { crashSite } from '../game/locations/crashSite.ts'
import { metal } from '../game/palette.ts'
import { OUTLINE } from '../game/pixels.ts'
import {
  H,
  LANE_FAR,
  LANE_NEAR,
  OVAL,
  TRACK_BOTTOM,
  TRACK_TOP,
  VIP_X,
  W,
  carShadow,
  drawFinishLine,
  drawPitBox,
  drawPitWall,
  drawSideTrack,
  drawStartLights,
  drawTopTrack,
  drawTyreWall,
  fill,
  ovalPoint,
  rng,
} from '../game/scenery.ts'
import type { GameAudio } from '../game/audio.ts'
import type { DrawEnv, Scene } from './types.ts'

const between = (t: number, from: number, to: number) => t >= from && t < to
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3

const CRASH_SITE_SCROLL = Math.round((VIP_X - 60) / 0.35)

function car(ctx: CanvasRenderingContext2D, id: CarId, x: number, lane: number, frame: number) {
  carShadow(ctx, Math.round(x), lane)
  ctx.drawImage(carSprite(id, frame >> 1), Math.round(x), lane - CAR_H)
}

function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, amount: number, seed: number) {
  const rand = rng(seed)
  for (let i = 0; i < amount; i++) {
    const life = (t * 1.4 + rand()) % 1
    const px = x - life * (20 + rand() * 30)
    const py = y - life * (10 + rand() * 16)
    const size = 2 + Math.round(life * 4)
    ctx.globalAlpha = life < 0.4 ? 0.7 : life < 0.75 ? 0.45 : 0.2
    fill(ctx, rand() > 0.5 ? metal.lighter : metal.light, px, py, size, size)
  }
  ctx.globalAlpha = 1
}

function sparks(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, amount: number) {
  const rand = rng(frame)
  for (let i = 0; i < amount; i++) {
    fill(ctx, rand() > 0.4 ? '#e8c43a' : '#fff3c4', x - rand() * 24, y - rand() * 3, 1 + Math.round(rand()), 1)
  }
}

function alert(ctx: CanvasRenderingContext2D, x: number, y: number) {
  fill(ctx, OUTLINE, x - 1, y - 1, 8, 12)
  fill(ctx, '#e8c43a', x, y, 6, 10)
  fill(ctx, OUTLINE, x + 2, y + 2, 2, 4)
  fill(ctx, OUTLINE, x + 2, y + 7, 2, 2)
}

const grid: { id: CarId; x: number; lane: number; pace: number }[] = [
  { id: 'car14', x: 12, lane: LANE_FAR, pace: -26 },
  { id: 'car3', x: 104, lane: LANE_FAR, pace: -14 },
  { id: 'car7', x: 196, lane: LANE_FAR, pace: 6 },
  { id: 'car31', x: -16, lane: LANE_NEAR, pace: -30 },
  { id: 'car9', x: 76, lane: LANE_NEAR, pace: -20 },
  { id: 'car22', x: 168, lane: LANE_NEAR, pace: 2 },
]

const PIT_CAR_X = 124
const PIT_LANE = 142

const crew = [
  { from: 24, to: 106, feet: 130, fifth: false },
  { from: 56, to: 138, feet: 160, fifth: false },
  { from: 300, to: 178, feet: 160, fifth: false },
  { from: 270, to: 214, feet: 130, fifth: false },
  { from: 318, to: 160, feet: 128, fifth: true },
]

function heading(angle: number): Heading {
  const vx = Math.sin(angle) * OVAL.rx
  const vy = -Math.cos(angle) * OVAL.ry
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left'
  return vy > 0 ? 'down' : 'up'
}

const scenes: Scene[] = [
  {
    id: 'disclaimer',
    duration: 5,
    draw: ({ ctx }) => fill(ctx, '#000000', 0, 0, W, H),
    overlay: (t) => (t > 0.4 ? { caption: { text: 'Основано на реальных событиях', size: 'md' } } : {}),
    cues: [
      { at: 0, run: () => music.play('tension', true) },
      { at: 0.5, run: (audio, loops) => (loops.crowd = audio.crowd()) },
    ],
  },
  {
    id: 'title',
    duration: 5,
    draw: ({ ctx, t }) => {
      drawTopTrack(ctx)
      const fade = clamp01(t / 1.5)
      ctx.globalAlpha = fade < 0.34 ? 1 : fade < 0.67 ? 0.66 : fade < 1 ? 0.33 : 0
      fill(ctx, '#000000', 0, 0, W, H)
      ctx.globalAlpha = 1
    },
    overlay: (t) => (t > 0.8 ? { caption: { text: 'Последний круг', size: 'xl' } } : {}),
    cues: [{ at: 0.6, run: (audio) => audio.engineSet(0.08, 0.05, 1) }],
  },
  {
    id: 'start',
    duration: 10,
    draw: ({ ctx, t, frame }) => {
      const go = 6.2
      const run = Math.max(0, t - go)
      drawSideTrack(ctx, { scroll: run * run * 70, stands: { sponsorInBox: true, crowd: true } })
      const lit = t < go ? Math.min(5, Math.floor(t)) : 0
      drawStartLights(ctx, 128, 18, lit)
      const sorted = [...grid].sort((a, b) => a.lane - b.lane)
      for (const entry of sorted) {
        const x = entry.x + run * run * entry.pace * 0.6
        car(ctx, entry.id, x, entry.lane, run > 0 ? frame : 0)
        if (between(run, 0.01, 1.6)) smoke(ctx, x + 6, entry.lane - 4, run, 6, entry.x + 40)
      }
    },
    shake: (t) => (between(t, 6.2, 7.6) ? 1 : 0),
    cues: [
      { at: 0.3, run: (audio) => audio.engineSet(0.25, 0.1) },
      ...[1, 2, 3, 4, 5].map((at) => ({ at, run: (audio: GameAudio) => audio.beep() })),
      {
        at: 6.2,
        run: (audio) => {
          audio.beep(true)
          audio.tireScreech()
          audio.engineSet(0.75, 0.18, 0.8)
        },
      },
    ],
    overlay: (t) => (t > 6.2 && t < 8 ? { sound: '[визг шин, рёв моторов]' } : {}),
  },
  {
    id: 'laps',
    duration: 12,
    draw: ({ ctx, t, frame }) => {
      const local = t % 6
      if (local < 4) {
        drawTopTrack(ctx)
        const lead = Math.PI / 2 - (t / 6) * Math.PI * 2
        const order: CarId[] = ['car7', 'car22', 'car3', 'car9', 'car14', 'car31']
        order.forEach((id, i) => {
          const angle = lead + i * 0.22 + (i > 1 ? i * 0.04 : 0)
          const p = ovalPoint(angle)
          const sprite = topCarSprite(id, heading(angle))
          ctx.drawImage(sprite, p.x - (sprite.width >> 1), p.y - (sprite.height >> 1))
        })
      } else {
        drawSideTrack(ctx, { scroll: 2000 + t * 40, stands: { sponsorInBox: true, crowd: true } })
        const pass = local - 4
        car(ctx, 'car7', -80 + pass * 280, LANE_FAR, frame)
        car(ctx, 'car22', -150 + pass * 280, LANE_NEAR, frame)
      }
    },
    overlay: (t) => ({ lap: t < 6 ? 'Круг 1' : 'Круг 2' }),
    cues: [
      { at: 0, run: (audio) => audio.engineSet(0.55, 0.06) },
      { at: 4.1, run: (audio) => audio.passBy() },
      { at: 10.1, run: (audio) => audio.passBy() },
    ],
  },
  {
    id: 'grind',
    duration: 6,
    draw: ({ ctx, t, frame }) => {
      drawSideTrack(ctx, { scroll: 4000 + t * 520, stands: { sponsorInBox: true, crowd: true } })
      const wobble = frame % 6 < 3 ? 0 : 1
      const x = 124
      car(ctx, 'car7', x, LANE_NEAR + wobble, frame)
      sparks(ctx, x + 14, LANE_NEAR - 2, frame, 6 + Math.round(t * 3))
      if (t > 1 && frame % 20 < 14) alert(ctx, x + 34, LANE_NEAR - 38)
    },
    shake: () => 1,
    overlay: (t) => ({
      ...(t < 1.6 ? { sound: '[скрежет металла]' } : {}),
      ...(between(t, 1.6, 5.8) ? { subtitle: { speaker: 'Пилот №7', text: 'Бокс, бокс! С машиной что-то не так.' } } : {}),
    }),
    cues: [
      { at: 0.2, run: (audio) => audio.metalGrind() },
      { at: 1.5, run: (audio) => audio.radioClick() },
    ],
  },
  {
    id: 'pit',
    duration: 12,
    draw: ({ ctx, t, frame }) => {
      drawPitBox(ctx)
      const arrive = easeOut(t / 2.5)
      const leave = Math.max(0, t - 10)
      const carX = t < 10 ? -80 + (PIT_CAR_X + 80) * arrive : PIT_CAR_X + leave * leave * 90

      const atCar = clamp01((t - 2.6) / 0.9)
      const back = clamp01((t - 9) / 0.8)
      const progress = atCar - back * atCar
      const running = (atCar > 0 && atCar < 1) || (back > 0 && back < 1)
      const working = atCar === 1 && back === 0
      const members = crew.map((member) => {
        const x = member.from + (member.to - member.from) * progress
        const goingOut = back > 0
        const target = goingOut ? member.from : member.to
        const dir: Direction = running ? (target > x ? 'right' : 'left') : x < PIT_CAR_X + 36 ? 'right' : 'left'
        const bob = working && (frame + member.from) % 10 < 5 ? 1 : 0
        const lean = member.fifth && between(t, 6, 7.1) ? 3 : 0
        const step = running ? walkFrame(t * 10) : IDLE_FRAME
        return { ...member, x, y: member.feet + bob + lean, dir, step }
      })

      const draw = (m: (typeof members)[number]) =>
        drawCharacter(ctx, art(m.fifth ? 'mechanicFifth' : 'mechanic'), m.dir, m.step, m.x, m.y)
      members.filter((m) => m.feet < PIT_LANE).forEach(draw)
      car(ctx, 'car7', carX, PIT_LANE, t < 2.5 || t > 10 ? frame : 0)
      members.filter((m) => m.feet >= PIT_LANE).forEach(draw)
      if (between(t, 3.6, 8.8) && frame % 4 < 2) {
        sparks(ctx, PIT_CAR_X + 18, PIT_LANE - 8, frame, 3)
        sparks(ctx, PIT_CAR_X + 58, PIT_LANE - 8, frame + 3, 3)
      }
    },
    overlay: (t) => (between(t, 3.5, 5.2) ? { sound: '[гайковёрты]' } : {}),
    cues: [
      { at: 0, run: (audio) => audio.engineSet(0.3, 0.08, 0.6) },
      { at: 2.5, run: (audio) => audio.engineSet(0.08, 0.04, 0.5) },
      { at: 3.6, run: (audio) => audio.impactWrench() },
      { at: 5.2, run: (audio) => audio.impactWrench() },
      { at: 7.6, run: (audio) => audio.impactWrench() },
      { at: 9.8, run: (audio) => audio.engineSet(0.6, 0.12, 0.4) },
    ],
  },
  {
    id: 'runaway',
    duration: 12,
    draw: ({ ctx, t, frame }) => {
      const scroll = 6000 + 520 * t + (26 * t * t * t) / 3
      drawSideTrack(ctx, { scroll, stands: { sponsorInBox: false, crowd: true } })
      const rival = W + 4 - (t - 1) * 90
      if (t > 1 && rival > -80) car(ctx, 'car22', rival, LANE_FAR, frame)
      const x = 116 + Math.round(t * 2)
      car(ctx, 'car7', x, LANE_NEAR, frame)
      if (t > 3.5) smoke(ctx, x + 22, LANE_NEAR - 16, t, Math.round((t - 3.5) * 3), 5)
      if (t > 8 && frame % 6 < 3) fill(ctx, '#e04848', x + 26, LANE_NEAR - 18, 4, 2)
    },
    shake: (t) => (t > 6 ? 1 + Math.floor((t - 6) / 3) : 0),
    overlay: (t) => ({
      hud: { speed: Math.round(280 + (t / 12) * 92), heat: clamp01(0.45 + (t / 12) * 0.55) },
      ...(t > 7 ? { sound: '[сигнал перегрева]' } : {}),
    }),
    cues: [
      { at: 0, run: (audio) => audio.engineSet(0.7, 0.13, 0.5) },
      { at: 4, run: (audio) => audio.engineSet(0.85, 0.15, 2) },
      { at: 8, run: (audio) => audio.engineSet(1, 0.17, 2) },
      { at: 7, run: (audio) => audio.overheatAlarm(5) },
    ],
  },
  {
    id: 'radio',
    duration: 8,
    draw: ({ ctx, t }) => {
      drawPitWall(ctx, clamp01(0.8 + t / 40), t)
      const engineer = art('engineer')
      ctx.drawImage(engineer, 112, 26, 96, 96)
      fill(ctx, OUTLINE, 104, 103, 112, 1)
      fill(ctx, metal.light, 104, 104, 112, 3)
      fill(ctx, metal.shine, 104, 104, 112, 1)
    },
    overlay: (t) => ({
      ...(between(t, 0.3, 3) ? { subtitle: { speaker: 'Инженер', text: 'Седьмой, сбрось скорость!' } } : {}),
      ...(between(t, 3.2, 5.5) ? { subtitle: { speaker: 'Инженер', text: 'Седьмой, ответь! Седьмой!' } } : {}),
      ...(t >= 5.7 ? { subtitle: { text: '…' }, sound: '[помехи в эфире]' } : {}),
    }),
    cues: [
      { at: 0, run: (audio) => audio.engineSet(0.95, 0.05, 0.5) },
      { at: 0.3, run: (audio) => audio.radioClick() },
      { at: 3.2, run: (audio) => audio.radioClick() },
      { at: 5.7, run: (audio) => audio.radioStatic(2.2) },
    ],
  },
  {
    id: 'crash',
    duration: 4,
    draw: ({ ctx, t, frame }) => {
      const impact = 0.7
      drawSideTrack(ctx, { scroll: CRASH_SITE_SCROLL, stands: { sponsorInBox: false, crowd: true } })
      drawTyreWall(ctx, 272, t >= impact)
      if (t < impact) {
        const k = t / impact
        const x = -80 + k * 280
        const y = Math.round(LANE_NEAR - (LANE_NEAR - TRACK_TOP - 8) * k * k)
        car(ctx, 'car7', x, y, frame)
        return
      }
      const after = t - impact
      ctx.drawImage(wreckSprite(), 188, TRACK_TOP - 14)
      const rand = rng(17)
      for (let i = 0; i < 16; i++) {
        const vx = (rand() - 0.3) * 90
        const vy = -40 - rand() * 60
        const px = 262 + vx * after
        const py = TRACK_TOP + vy * after + 80 * after * after
        if (py < TRACK_BOTTOM + 10) fill(ctx, rand() > 0.5 ? liveries.car7.A : metal.dark, px, py, 2, 2)
      }
      smoke(ctx, 230, TRACK_TOP - 6, t, 10, 9)
    },
    shake: (t) => (between(t, 0.7, 1.3) ? 3 : 0),
    flash: (t) => (between(t, 0.7, 0.77) || between(t, 0.84, 0.9) ? 1 : 0),
    overlay: (t) => (t > 1.2 ? { sound: '[удар. тишина]' } : {}),
    cues: [
      {
        at: 0.7,
        run: (audio, loops) => {
          audio.silence()
          music.stop(0.05)
          loops.crowd = undefined
          audio.crash()
        },
      },
    ],
  },
  {
    id: 'finish',
    duration: 8,
    draw: ({ ctx, t, frame }) => {
      drawSideTrack(ctx, { scroll: 9400, stands: { sponsorInBox: false, crowd: true } })
      drawFinishLine(ctx, 200)
      smoke(ctx, 40, TRACK_TOP - 30, t, 6, 3)
      fill(ctx, OUTLINE, 223, TRACK_TOP - 41, 3, 30)
      fill(ctx, metal.shine, 224, TRACK_TOP - 40, 1, 28)
      const wave = frame % 30 < 15 ? 0 : 1
      for (let fy = 0; fy < 8; fy += 2) {
        for (let fx = 0; fx < 12; fx += 2) {
          const dark = ((fx + fy) / 2) % 2 === 0
          fill(ctx, dark ? '#141a1e' : '#c9d0d2', 225 + fx, TRACK_TOP - 40 + fy + (fx > 5 ? wave : 0), 2, 2)
        }
      }
      car(ctx, 'car22', -80 + t * 52, LANE_FAR, t < 7.6 ? frame >> 1 : 0)
    },
    cues: [
      { at: 0.4, run: (audio, loops) => (loops.wind = audio.wind()) },
      { at: 0.8, run: (audio) => audio.engineSet(0.3, 0.035, 1) },
      { at: 7.2, run: (audio) => audio.engineStop() },
    ],
    overlay: (t) => (t < 3 ? { sound: '[трибуны молчат]' } : {}),
  },
  {
    id: 'photo',
    duration: 5,
    draw: ({ ctx, t }) => {
      fill(ctx, '#050706', 0, 0, W, H)
      const frameX = 62
      const frameY = 22
      fill(ctx, OUTLINE, frameX - 1, frameY - 1, 198, 118)
      fill(ctx, '#e8ece9', frameX, frameY, 196, 116)
      fill(ctx, '#c9d0d2', frameX + 195, frameY + 1, 1, 115)
      fill(ctx, '#c9d0d2', frameX + 1, frameY + 115, 195, 1)
      ctx.save()
      ctx.beginPath()
      ctx.rect(frameX + 4, frameY + 4, 188, 100)
      ctx.clip()
      ctx.translate(0, -8)
      const scroll = (VIP_X - 140) / 0.35
      drawSideTrack(ctx, { scroll, stands: { sponsorInBox: false, crowd: true } })
      car(ctx, 'car22', 100, LANE_FAR + 2, 0)
      ctx.restore()
      const develop = clamp01((t - 0.1) / 1.4)
      ctx.globalAlpha = develop < 0.25 ? 1 : develop < 0.5 ? 0.7 : develop < 0.75 ? 0.4 : develop < 1 ? 0.15 : 0
      fill(ctx, '#ffffff', frameX + 4, frameY + 4, 188, 100)
      ctx.globalAlpha = 1
    },
    flash: (t) => (t < 0.12 ? 1 : 0),
    overlay: (t) => (t > 1.4 ? { photo: 'Фото с финиша · болид №22 на фоне трибуны' } : { sound: '[щелчок затвора]' }),
    cues: [{ at: 0, run: (audio) => audio.shutter() }],
  },
  {
    id: 'two-days-later',
    duration: 8,
    draw: ({ ctx, t, frame }) => {
      if (t < 3) {
        fill(ctx, '#000000', 0, 0, W, H)
        return
      }
      ctx.drawImage(art('crashSite'), 0, 0)
      const { x, y } = crashSite.start
      const walk = clamp01((t - 3) / 3.5)
      const step = walk < 1 ? walkFrame(frame / 4) : IDLE_FRAME
      drawCharacter(ctx, art('detective'), 'right', step, Math.round(-16 + walk * (x + 16)), y)
      const fade = clamp01((t - 3) / 1.2)
      ctx.globalAlpha = fade < 0.34 ? 1 : fade < 0.67 ? 0.66 : fade < 1 ? 0.33 : 0
      fill(ctx, '#000000', 0, 0, W, H)
      ctx.globalAlpha = 1
    },
    cues: [{ at: 3, run: () => music.play('tension', true) }],
    overlay: (t, playerName) => ({
      ...(t < 3 ? { caption: { text: 'Спустя два дня…', size: 'md' as const } } : {}),
      ...(t > 5 ? { caption: { text: `Детектив ${playerName}, вас ждут на трассе`, size: 'md' as const } } : {}),
    }),
  },
]

export const script: Scene[] = scenes.map((scene) =>
  scene.id === 'disclaimer'
    ? scene
    : {
        ...scene,
        draw: (env: DrawEnv) => {
          scene.draw(env)
          vignette(env.ctx)
        },
      },
)

export const totalDuration = script.reduce((sum, scene) => sum + scene.duration, 0)
