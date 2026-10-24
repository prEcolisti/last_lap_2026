import { IDLE_FRAME, walkFrame, type Direction } from '../game/characters.ts'
import { art, type ArtId } from '../game/cutsceneArt.ts'
import type { GameAudio } from '../game/audio.ts'
import type { Line } from '../game/dialogues.ts'
import {
  APPROACH_Y,
  DETECTIVE_SEAT,
  DOOR_X,
  FEET,
  SUSPECT_SEAT,
  TABLE_TOP,
  WALL_BOTTOM,
  drawChairs,
  drawDocuments,
  drawFolder,
  drawPerson,
  drawRoom,
  drawSeated,
  drawTable,
} from '../game/interrogationRoom.ts'
import { vignette } from '../game/lighting.ts'
import { music } from '../game/music.ts'
import { detectivePortraits, suspectPortraits, type Mood } from '../game/portraits.ts'
import { H, W, fill } from '../game/pixels.ts'
import { suspects, type Suspect } from '../game/story.ts'
import type { Scene } from './types.ts'

export const CULPRIT = 'sponsor'

const between = (t: number, from: number, to: number) => t >= from && t < to
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const DOOR_FEET = WALL_BOTTOM + 2
const HOP = 0.45
const HOP_HEIGHT = 12
const TYPE_SPEED = 40
const SILENCE_SPEED = 2

const sheets: Record<string, ArtId> = { pilot: 'pilot22', mechanic: 'mechanic', sponsor: 'sponsor' }

interface Pose {
  x: number
  y: number
  dir: Direction
  frame: number
  seated?: boolean
}

const seated: Pose = { x: SUSPECT_SEAT, y: FEET, dir: 'right', frame: IDLE_FRAME, seated: true }

function blackout(ctx: CanvasRenderingContext2D, amount: number) {
  const k = clamp01(amount)
  if (!k) return
  ctx.globalAlpha = k >= 1 ? 1 : Math.ceil(k * 3) / 4
  fill(ctx, '#000000', 0, 0, W, H)
  ctx.globalAlpha = 1
}

function black({ ctx }: { ctx: CanvasRenderingContext2D }) {
  fill(ctx, '#000000', 0, 0, W, H)
}

function drawScene(ctx: CanvasRenderingContext2D, sheet: ArtId, suspect: Pose | null, door = 0, folder?: { x: number; y: number }) {
  drawRoom(ctx, door)
  drawChairs(ctx)
  drawSeated(ctx, art('detective'), 'left', DETECTIVE_SEAT)
  if (suspect?.seated) drawSeated(ctx, art(sheet), suspect.dir, suspect.x)
  else if (suspect) drawPerson(ctx, art(sheet), suspect.dir, suspect.frame, suspect.x, suspect.y)
  drawTable(ctx)
  if (folder) drawFolder(ctx, folder.x, folder.y)
  vignette(ctx)
}

function opening(sheet: ArtId): Scene[] {
  const walkFrom = 1.6
  const walkTime = 6
  const hopAt = walkFrom + walkTime + 0.3
  const sitAt = hopAt + HOP
  const steps = Array.from({ length: 9 }, (_, i) => ({
    at: walkFrom + 0.2 + i * 0.7,
    run: (audio: GameAudio) => audio.footstep(),
  }))

  return [
    {
      id: 'room',
      duration: 3,
      draw: ({ ctx, t }) => {
        drawScene(ctx, sheet, null)
        blackout(ctx, 1 - t / 1.2)
      },
      overlay: (t) => (t > 1.2 ? { sound: '[гудит лампа]' } : {}),
      cues: [
        {
          at: 0,
          run: (audio, loops) => {
            music.stop(2)
            loops.room = audio.roomTone()
          },
        },
      ],
    },
    {
      id: 'enter',
      duration: 9,
      draw: ({ ctx, t, frame }) => {
        const door = t < 5 ? Math.floor(clamp01(t / 0.8) * 4) / 4 : 1 - Math.floor(clamp01((t - 5) / 0.8) * 4) / 4
        let pose: Pose | null = null
        if (t >= 0.9) {
          const walk = clamp01((t - walkFrom) / walkTime)
          const down = APPROACH_Y - DOOR_FEET
          const distance = walk * (down + SUSPECT_SEAT - DOOR_X)
          const across = Math.max(0, distance - down)
          const hop = clamp01((t - hopAt) / HOP)
          pose = {
            x: DOOR_X + across,
            y: Math.min(APPROACH_Y, DOOR_FEET + distance) - (APPROACH_Y - FEET) * hop - Math.sin(hop * Math.PI) * HOP_HEIGHT,
            dir: across === 0 ? 'down' : walk < 1 ? 'right' : hop > 0 ? 'up' : 'right',
            frame: walk > 0 && walk < 1 ? walkFrame(frame / 7) : IDLE_FRAME,
            seated: t >= sitAt,
          }
          if (pose.seated) pose.dir = 'right'
        }
        drawScene(ctx, sheet, pose, door)
      },
      cues: [
        { at: 0, run: (audio) => audio.door() },
        ...steps,
        { at: 5.8, run: (audio) => audio.doorShut() },
        { at: sitAt, run: (audio) => audio.footstep() },
      ],
    },
  ]
}

type Beat = Line & { sound?: (audio: GameAudio) => void }

const ask = (text: string, sharp = false): Beat => ({ by: 'detective', text, sharp })
const say = (mood: Mood, text: string, sound?: Beat['sound']): Beat => ({ by: 'suspect', text, mood, sound })

function beatScene(suspect: Suspect, beat: Beat, index: number): Scene {
  const speed = beat.text === '...' ? SILENCE_SPEED : TYPE_SPEED
  const dialogue =
    beat.by === 'detective'
      ? { speaker: 'Детектив', portrait: beat.sharp ? detectivePortraits.sharp : detectivePortraits.calm, side: 'right' as const }
      : { speaker: suspect.name, portrait: suspectPortraits[suspect.id][beat.mood], side: 'left' as const }
  return {
    id: `beat-${index}`,
    duration: beat.text.length / speed + 1.4 + beat.text.length * 0.03,
    draw: ({ ctx }) => drawScene(ctx, sheets[suspect.id], seated),
    overlay: (t) => ({ dialogue: { ...dialogue, text: beat.text.slice(0, Math.ceil(t * speed)) } }),
    cues: beat.sound ? [{ at: 0, run: beat.sound }] : undefined,
  }
}

const talks: Record<string, Beat[]> = {
  pilot: [
    ask('Садитесь. Разговор будет недолгим.'),
    say('calm', 'Опять вопросы? Я уже всё вам рассказал.'),
    ask('Двенадцать лет вы были вторым. Контракты, обложки, спонсор — всё доставалось ему.', true),
    ask('А в этой гонке вы наконец финишировали первым. Удобно, не правда ли?', true),
    say('nervous', 'Вы… вы сейчас серьёзно?'),
    ask('Мотив у вас есть. Зависть — один из самых старых мотивов на свете.', true),
    say('broken', 'Я был за рулём! Всю гонку! Телеметрия, камеры, тысячи зрителей на трибунах — у меня железное алиби!'),
    say('broken', 'Он был моим лучшим другом. Я его ещё даже не похоронил, а вы…'),
    ask('Алиби можно подстроить. Я своё мнение не изменю.', true),
    say('broken', '…Делайте что хотите.'),
  ],
  mechanic: [
    ask('Садитесь.'),
    say('broken', 'Эх…', (audio) => audio.sigh()),
    say('calm', 'Так и знал. В таких делах первым всегда винят механика.'),
    ask('Вы меняли колесо на последнем пит-стопе. Сразу после него машина перестала тормозить.', true),
    ask('Вы стояли к болиду ближе всех. Кто, если не вы?', true),
    say('calm', 'Левое заднее колесо, детектив. Рядом двое, камера бокса всё пишет. К кокпиту я не подходил.'),
    say('broken', 'Двое суток в изоляторе, а теперь опять всё то же. Обидно. Честно — обидно.'),
    say('calm', 'Но спорить не буду. Пишите, что считаете нужным.'),
  ],
  sponsor: [say('nervous', '...'), ask('...', true)],
}

function wrongEnding(sheet: ArtId): Scene[] {
  return [
    {
      id: 'fade-out',
      duration: 1.6,
      draw: ({ ctx, t }) => {
        drawScene(ctx, sheet, seated)
        blackout(ctx, t / 1.2)
      },
      cues: [
        {
          at: 1.2,
          run: (audio, loops) => {
            audio.silence()
            loops.room = undefined
          },
        },
      ],
    },
    {
      id: 'wrong',
      duration: 7,
      draw: black,
      overlay: (t) => (t > 0.6 ? { caption: { text: 'Ты ошибся.', size: 'xl' } } : {}),
      cues: [
        { at: 0.6, run: (audio) => audio.wrongSting() },
        { at: 1.4, run: () => music.play('sad') },
      ],
    },
  ]
}

const story = [
  'Как это было',
  'Спонсор готовился заранее. На листке со схемой круиз-контроля болида №7 он обвёл провод от датчика тормоза и приписал: «отключить?», а у дросселя — «100%».',
  'Незадолго до пит-стопа он вскочил с кресла в VIP-ложе и ушёл, оставив листок на столике. В боксе он надел фирменный комбинезон без бейджа и встал к машине пятым — в табеле смены было только четыре фамилии.',
  'Пока механики меняли колёса, «пятый механик» возился в кокпите. Чистыми, без мазута руками он изолентой и термоусадкой отрезал тормоза от модуля и зажал дроссель на полном газу.',
  'После пит-стопа болид №7 только разгонялся. Пилот жал на тормоз, но машина его не слушалась. Мотор перегрелся изнутри, и на выходе из поворота болид по прямой ушёл в отбойник — на асфальте ни одного следа торможения.',
  'Пока трибуны смотрели на финиш, спонсора в ложе не было: на фото с финиша его кресло пустое. Позже он говорил, что «вышел позвонить».',
  'Схема с его пометками, пустое кресло, лишний комбинезон и показания механика и бармена сложились в одну картину. Спонсор команды убил своего пилота.',
]

const FOLDER_LANDS = 1.05
const STAMP_HITS = 1.6

const solvedEnding: Scene[] = [
  {
    id: 'folder',
    duration: 3.5,
    draw: ({ ctx, t }) => {
      const k = clamp01((t - 0.6) / (FOLDER_LANDS - 0.6))
      const folder = t < 0.6 ? undefined : { x: 330 - 170 * k, y: 60 + (TABLE_TOP - 60) * k - Math.sin(k * Math.PI) * 30 }
      drawScene(ctx, 'sponsor', seated, 0, folder)
      blackout(ctx, (t - 2.9) / 0.6)
    },
    shake: (t) => (between(t, FOLDER_LANDS, FOLDER_LANDS + 0.12) ? 1 : 0),
    overlay: (t) => (between(t, FOLDER_LANDS, 2.9) ? { sound: '[на стол падает папка]' } : {}),
    cues: [{ at: FOLDER_LANDS, run: (audio) => audio.paperSlap() }],
  },
  {
    id: 'documents',
    duration: 2.5,
    draw: ({ ctx, t }) => {
      drawDocuments(ctx, art('mechanicFifth'), 0)
      blackout(ctx, 1 - t / 0.8)
    },
  },
  {
    id: 'stamp',
    duration: 7.5,
    draw: ({ ctx, t }) => {
      drawDocuments(ctx, art('mechanicFifth'), t < 1 ? 0 : Math.min(1, (t - 1) / (STAMP_HITS - 1)))
      blackout(ctx, (t - 6.5) / 1)
    },
    shake: (t) => (between(t, STAMP_HITS, STAMP_HITS + 0.2) ? 2 : 0),
    overlay: (t) => (between(t, STAMP_HITS, 3.6) ? { sound: '[удар печати]' } : {}),
    cues: [
      {
        at: STAMP_HITS,
        run: (audio, loops) => {
          loops.room?.stop()
          loops.room = undefined
          audio.stamp()
        },
      },
      { at: STAMP_HITS + 1, run: () => music.play('victory') },
    ],
  },
  {
    id: 'credits-thanks',
    duration: 8,
    draw: black,
    overlay: (t) =>
      between(t, 0.8, 7.4)
        ? {
            caption: {
              text: 'Вы раскрыли дело, показали себя как настоящий профессионал.\nИ ты сможешь стать таким же.',
              size: 'sm',
            },
          }
        : {},
  },
  ...story.map(
    (text, i): Scene => ({
      id: `credits-story-${i}`,
      duration: 3 + text.length / 22,
      draw: black,
      overlay: (t) => (t > 0.6 ? { caption: { text, size: 'sm' } } : {}),
    }),
  ),
  {
    id: 'credits-team',
    duration: 12,
    draw: black,
    overlay: (t) =>
      between(t, 0.8, 11.4)
        ? {
            caption: {
              text: [
                'Работали над проектом:',
                'команда «прЕколисты»',
                '',
                'Наши участники:',
                'Преходько Максим',
                'Карпухин Марк',
                'Загоруй Валентина',
                'Лядовой Дмитрий',
                'Штеренфельд Анна',
                'Матвейчук Алексей',
              ].join('\n'),
              size: 'sm',
            },
          }
        : {},
  },
  {
    id: 'end',
    duration: 3,
    draw: black,
  },
]

export function accusationScript(suspectId: string): Scene[] | null {
  const suspect = suspects.find((item) => item.id === suspectId)
  if (!suspect) return null
  const sheet = sheets[suspect.id]
  return [
    ...opening(sheet),
    ...talks[suspect.id].map((beat, i) => beatScene(suspect, beat, i)),
    ...(suspect.id === CULPRIT ? solvedEnding : wrongEnding(sheet)),
  ]
}
