import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ButtonLink } from '../components/Button.tsx'
import { DialogueBox } from '../components/DialogueBox.tsx'
import { GameHeader } from '../components/GameHeader.tsx'
import { PageShell } from '../components/PageShell.tsx'
import { useAuth } from '../auth/useAuth.ts'
import { characterSheets, drawCharacter, IDLE_FRAME, walkFrame, type Direction } from '../game/characters.ts'
import { distanceToRect, findLocation, npcDone, type Location, type Point, type Rect } from '../game/locations/index.ts'
import { findPath } from '../game/pathfinding.ts'
import { H, OUTLINE, W } from '../game/pixels.ts'
import { PORTRAIT_SIZE } from '../game/portraits.ts'
import { loadProgress, saveProgress } from '../game/progress.ts'
import { useBackground } from '../game/useBackground.ts'
import { useConversation } from '../game/useConversation.ts'
import { useImage } from '../game/useImage.ts'
import { useMusic } from '../game/useMusic.ts'
import { routes } from '../routes.ts'
import './LocationPage.css'

const pct = (value: number, total: number) => `${(value / total) * 100}%`

const SPEED = 56
const REACH = 22
const STEPS_PER_SECOND = 8
const NPC = 'npc'

interface Drop {
  x: number
  y: number
  speed: number
}

function makeRain(count: number): Drop[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * (W + 40),
    y: Math.random() * H,
    speed: 140 + Math.random() * 80,
  }))
}

function nearestTarget(location: Location, x: number, y: number): string | null {
  const targets: { id: string; rect: Rect }[] = location.clues.map((clue) => ({ id: clue.id, rect: clue }))
  if (location.npc) targets.push({ id: NPC, rect: location.npc.area })
  let best: string | null = null
  let bestDistance = REACH
  for (const { id, rect } of targets) {
    const distance = distanceToRect(rect, x, y)
    if (distance <= bestDistance) {
      best = id
      bestDistance = distance
    }
  }
  return best
}

export function LocationPage() {
  const { id } = useParams()
  const location = findLocation(id)
  if (!location) return <Navigate to={routes.locations} replace />
  return <LocationScreen key={location.id} location={location} />
}

function LocationScreen({ location }: { location: Location }) {
  useMusic(location.music)
  const { user } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [examined, setExamined] = useState<string[]>(() => (user ? loadProgress(user.id).examined : []))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [nearId, setNearId] = useState<string | null>(null)

  const background = useBackground(location)
  const detective = useImage(characterSheets.detective)
  const { npc } = location
  const npcSheet = useImage(npc?.sheet ?? '')
  const talk = useConversation(npc?.id ?? '', npc?.topics ?? [], npc?.idleMood ?? 'calm')
  const askedRef = useRef(talk.asked)
  const talkingRef = useRef(false)
  useEffect(() => {
    askedRef.current = talk.asked
    talkingRef.current = activeId === NPC
  })

  const player = useRef({ ...location.start, moving: false, step: 0 })
  const path = useRef<Point[]>([])
  const nearRef = useRef<string | null>(null)

  const walkTo = useCallback(
    (target: Point) => {
      path.current = findPath(location, player.current, target)
    },
    [location],
  )

  const examine = useCallback(
    (clueId: string) => {
      setActiveId(clueId)
      const clue = location.clues.find((item) => item.id === clueId)
      if (!clue || (clue.requires && !askedRef.current.includes(clue.requires))) return
      setExamined((current) => {
        if (current.includes(clueId)) return current
        const next = [...current, clueId]
        if (user) saveProgress(user.id, { examined: next })
        return next
      })
    },
    [location, user],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyE' && nearRef.current) examine(nearRef.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [examine])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !background || !detective) return
    ctx.imageSmoothingEnabled = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rain = makeRain(location.rain && !reducedMotion ? 90 : 0)
    let last = performance.now()
    let raf = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const p = player.current

      const waypoint = path.current[0]
      p.moving = Boolean(waypoint)
      if (waypoint) {
        const dx = waypoint.x - p.x
        const dy = waypoint.y - p.y
        const distance = Math.hypot(dx, dy)
        const stepLength = SPEED * dt
        if (distance <= stepLength) {
          p.x = waypoint.x
          p.y = waypoint.y
          path.current.shift()
        } else {
          p.x += (dx / distance) * stepLength
          p.y += (dy / distance) * stepLength
        }
        if (distance > 0.5) {
          const dir: Direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
          p.dir = dir
        }
        p.step += dt * STEPS_PER_SECOND
      }

      const near = nearestTarget(location, p.x, p.y)
      if (near !== nearRef.current) {
        nearRef.current = near
        setNearId(near)
      }

      ctx.drawImage(background, 0, 0)
      if (npc && npcSheet) npc.draw(ctx, npcSheet, now / 1000, talkingRef.current)

      const goal = path.current[path.current.length - 1]
      if (goal) {
        ctx.fillStyle = OUTLINE
        ctx.fillRect(Math.round(goal.x) - 2, Math.round(goal.y) - 1, 5, 3)
        ctx.fillStyle = '#e8c43a'
        ctx.fillRect(Math.round(goal.x) - 1, Math.round(goal.y), 3, 1)
      }

      drawCharacter(ctx, detective, p.dir, p.moving ? walkFrame(p.step) : IDLE_FRAME, p.x, p.y)

      if (near) {
        const bx = Math.round(p.x) - 3
        const by = Math.round(p.y) - 42
        ctx.fillStyle = OUTLINE
        ctx.fillRect(bx - 1, by - 1, 8, 12)
        ctx.fillStyle = '#e8c43a'
        ctx.fillRect(bx, by, 6, 10)
        ctx.fillStyle = OUTLINE
        ctx.fillRect(bx + 2, by + 2, 2, 4)
        ctx.fillRect(bx + 2, by + 7, 2, 2)
      }

      ctx.fillStyle = 'rgba(120, 150, 165, 0.45)'
      for (const drop of rain) {
        drop.y += drop.speed * dt
        drop.x -= drop.speed * dt * 0.25
        if (drop.y > H) {
          drop.y -= H + 6
          drop.x = Math.random() * (W + 40)
        }
        ctx.fillRect(Math.round(drop.x), Math.round(drop.y), 1, 3)
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [background, detective, location, npc, npcSheet])

  const onStageClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    walkTo({
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    })
  }

  const clues = location.clues
  const active = clues.find((clue) => clue.id === activeId) ?? null
  const isLocked = (clue: (typeof clues)[number]) => Boolean(clue.requires && !talk.asked.includes(clue.requires))
  const talked = npc ? npcDone(npc, talk.asked) : false
  const found = clues.filter((clue) => examined.includes(clue.id)).length + (talked ? 1 : 0)
  const total = clues.length + (npc ? 1 : 0)
  const nearTitle = nearId === NPC ? npc?.name : clues.find((clue) => clue.id === nearId)?.title

  return (
    <PageShell fadedTrack headerSlot={<GameHeader label={location.title} />}>
      <div className="site">
        <div className="site__intro">
          <h1 className="site__title">{location.title}</h1>
          <p className="site__lead">{location.lead}</p>
        </div>

        <div className="site__stage" style={{ aspectRatio: `${W} / ${H}` }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="site__canvas"
            onClick={onStageClick}
            aria-label="Сцена: щёлкните, куда идти"
          />
          {clues.map((clue) => {
            const seen = examined.includes(clue.id)
            return (
              <button
                key={clue.id}
                type="button"
                className={`site__spot${clue.id === activeId ? ' site__spot--active' : ''}`}
                style={{ left: pct(clue.x, W), top: pct(clue.y, H), width: pct(clue.w, W), height: pct(clue.h, H) }}
                onClick={() => walkTo({ x: clue.x + clue.w / 2, y: clue.y + clue.h / 2 })}
                aria-label={`Подойти: ${clue.title}${seen ? ', осмотрено' : ''}`}
              >
                {seen && (
                  <span className="site__marker" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
          {npc && (
            <button
              type="button"
              className={`site__spot${activeId === NPC ? ' site__spot--active' : ''}`}
              style={{ left: pct(npc.area.x, W), top: pct(npc.area.y, H), width: pct(npc.area.w, W), height: pct(npc.area.h, H) }}
              onClick={() => walkTo({ x: npc.area.x + npc.area.w / 2, y: npc.area.y + npc.area.h })}
              aria-label={`Подойти: ${npc.name}${talked ? ', разговор окончен' : ''}`}
            >
              {talked && (
                <span className="site__marker" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          )}
          {nearId && (
            <button type="button" className="site__inspect" onClick={() => examine(nearId)}>
              <kbd>E</kbd> {nearId === NPC ? 'Поговорить' : 'Осмотреть'}: {nearTitle}
            </button>
          )}
        </div>
        <p className="site__controls">
          Нажмите на сцену, куда идти · подойдите к месту, чтобы осмотреть его{npc ? ', или к свидетелю, чтобы поговорить' : ''}
        </p>

        <div className="site__panels">
          <section className="site__note" aria-live="polite">
            {activeId === NPC && npc ? (
              <div className="site__talk">
                <div className="site__witness">
                  <img
                    className="site__witness-portrait"
                    src={npc.portraits[talk.mood]}
                    alt={npc.name}
                    width={PORTRAIT_SIZE * 2}
                    height={PORTRAIT_SIZE * 2}
                  />
                  <h2>{npc.name}</h2>
                </div>
                <DialogueBox talk={talk} speaker={npc.name} placeholder="Выберите, о чём спросить." />
              </div>
            ) : active ? (
              <>
                <h2>{active.title}</h2>
                {isLocked(active) ? (
                  <p>{active.locked}</p>
                ) : (
                  <>
                    {active.image && (
                      <img className="site__closeup" src={active.image} alt={`${active.title} крупным планом`} />
                    )}
                    <p>{active.note}</p>
                  </>
                )}
              </>
            ) : (
              <p className="site__placeholder">Подойдите к чему-нибудь интересному и нажмите «Осмотреть».</p>
            )}
          </section>

          <section className="site__notebook">
            <h2>
              Блокнот <span>{found}/{total}</span>
            </h2>
            <ul>
              {clues.map((clue) => (
                <li key={clue.id} data-found={examined.includes(clue.id)}>
                  {examined.includes(clue.id) ? clue.title : '???'}
                </li>
              ))}
              {npc && (
                <li data-found={talked}>{talked ? `Разговор: ${npc.name.toLowerCase()}` : '???'}</li>
              )}
            </ul>
            {talk.facts.length > 0 && (
              <ul className="site__facts">
                {talk.facts.map((item) => (
                  <li key={item.id}>{item.fact}</li>
                ))}
              </ul>
            )}
            <ButtonLink to={routes.locations} variant="ghost" block>
              <span className="btn__arrow" aria-hidden="true">
                ←
              </span>
              К локациям
            </ButtonLink>
          </section>
        </div>
      </div>
    </PageShell>
  )
}
