import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button } from '../components/Button.tsx'
import { GameAudio } from '../game/audio.ts'
import { loadCutsceneArt } from '../game/cutsceneArt.ts'
import { music } from '../game/music.ts'
import { H, W } from '../game/scenery.ts'
import { blip, voiceOf } from '../game/voice.ts'
import type { Overlay, Scene, SharedLoops } from './types.ts'
import './Cutscene.css'

interface CutsceneProps {
  scenes: Scene[]
  title?: string
  playerName: string
  onFinish(skipped: boolean): void
}

type Phase = 'ready' | 'playing' | 'paused'

const SUBTITLE_SPEED = 35

function useStageScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const update = () => {
      const fit = Math.min(window.innerWidth / W, window.innerHeight / H)
      setScale(fit >= 2 ? Math.floor(fit) : fit)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return scale
}

function locate(scenes: Scene[], time: number) {
  let start = 0
  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index]
    if (time < start + scene.duration) return { index, t: time - start }
    start += scene.duration
  }
  return null
}

function spoken(overlay: Overlay) {
  if (overlay.dialogue) return { speaker: overlay.dialogue.speaker, text: overlay.dialogue.text }
  if (overlay.subtitle?.speaker) return { speaker: overlay.subtitle.speaker, text: overlay.subtitle.text }
  return null
}

export function Cutscene({ scenes, title = 'Последний круг', playerName, onFinish }: CutsceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [overlay, setOverlay] = useState<Overlay>({})
  const scale = useStageScale()
  const [artReady, setArtReady] = useState(false)

  useEffect(() => {
    let alive = true
    void loadCutsceneArt().then(() => {
      if (alive) setArtReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const audioRef = useRef<GameAudio | null>(null)
  const loopsRef = useRef<SharedLoops>({})
  const rafRef = useRef(0)
  const clock = useRef({ time: 0, last: 0, paused: false, scene: -1, fired: new Set<number>(), overlayKey: '', subtitle: { text: '', since: 0 }, said: '' })
  const finishedRef = useRef(false)
  const reducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const finish = useCallback(
    (skipped: boolean) => {
      if (finishedRef.current) return
      finishedRef.current = true
      cancelAnimationFrame(rafRef.current)
      audioRef.current?.close()
      audioRef.current = null
      music.hold('cutscene', false)
      onFinish(skipped)
    },
    [onFinish],
  )

  const tick = useCallback(
    function frame(now: number) {
      const state = clock.current
      const dt = Math.min(0.1, (now - state.last) / 1000)
      state.last = now
      if (!state.paused) state.time += dt

      const where = locate(scenes, state.time)
      if (!where) {
        finish(false)
        return
      }
      const scene = scenes[where.index]
      if (where.index !== state.scene) {
        state.scene = where.index
        state.fired = new Set()
      }

      const audio = audioRef.current
      scene.cues?.forEach((cue, i) => {
        if (cue.at <= where.t && !state.fired.has(i)) {
          state.fired.add(i)
          if (audio) cue.run(audio, loopsRef.current)
        }
      })

      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = false
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)
        const amplitude = reducedMotion.current ? 0 : (scene.shake?.(where.t) ?? 0)
        if (amplitude) {
          ctx.translate(
            Math.round((Math.random() * 2 - 1) * amplitude),
            Math.round((Math.random() * 2 - 1) * amplitude),
          )
        }
        scene.draw({ ctx, t: where.t, frame: Math.floor(state.time * 30), reducedMotion: reducedMotion.current })
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        const flash = reducedMotion.current ? 0 : (scene.flash?.(where.t) ?? 0)
        if (flash) {
          ctx.globalAlpha = flash
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, W, H)
          ctx.globalAlpha = 1
        }
      }

      const next = scene.overlay?.(where.t, playerName) ?? {}
      if (next.subtitle && !reducedMotion.current) {
        const { text } = next.subtitle
        if (text !== state.subtitle.text) state.subtitle = { text, since: state.time }
        next.subtitle = { ...next.subtitle, text: text.slice(0, Math.ceil((state.time - state.subtitle.since) * SUBTITLE_SPEED)) }
      } else state.subtitle.text = ''
      const line = spoken(next)
      const said = line ? `${line.speaker}
${line.text}` : ''
      if (line && said.length > state.said.length && said.startsWith(state.said)) blip(voiceOf(line.speaker), said[said.length - 1])
      state.said = said
      const key = JSON.stringify(next)
      if (key !== state.overlayKey) {
        state.overlayKey = key
        setOverlay(next)
      }

      rafRef.current = requestAnimationFrame(frame)
    },
    [finish, playerName, scenes],
  )

  const start = () => {
    audioRef.current = GameAudio.create()
    clock.current.last = performance.now()
    setPhase('playing')
    rafRef.current = requestAnimationFrame(tick)
  }

  const togglePause = useCallback(() => {
    const state = clock.current
    state.paused = !state.paused
    if (state.paused) audioRef.current?.pause()
    else audioRef.current?.resume()
    music.hold('cutscene', state.paused)
    setPhase(state.paused ? 'paused' : 'playing')
  }, [])

  useEffect(() => {
    if (phase === 'ready') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(true)
      if (event.key === ' ') {
        event.preventDefault()
        togglePause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, finish, togglePause])

  useEffect(() => {
    if (phase !== 'playing') return
    const onVisibility = () => {
      if (document.hidden && !clock.current.paused) togglePause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [phase, togglePause])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      audioRef.current?.close()
      audioRef.current = null
      music.hold('cutscene', false)
    },
    [],
  )

  const stageStyle = {
    '--px': `${scale}px`,
    '--portrait': `${62 * Math.max(1, Math.floor(scale / 2))}px`,
    width: W * scale,
    height: H * scale,
  } as CSSProperties

  return (
    <div className="cutscene">
      <div className="cutscene__stage" style={stageStyle}>
        <canvas ref={canvasRef} width={W} height={H} className="cutscene__canvas" aria-hidden="true" />

        {phase === 'ready' ? (
          <div className="cutscene__ready">
            <p className="cutscene__ready-kicker">{title}</p>
            <Button onClick={start} disabled={!artReady} autoFocus>
              Нажмите, чтобы начать
            </Button>
            <p className="cutscene__ready-hint">
              Включите звук<span className="cutscene__keys"> · Esc — пропустить · Пробел — пауза</span>
            </p>
            <p className="cutscene__rotate">Поверните телефон горизонтально — так кадр будет крупнее</p>
          </div>
        ) : (
          <div className="cutscene__overlay" aria-live="polite">
            {overlay.caption && (
              <p className={`cutscene__caption cutscene__caption--${overlay.caption.size}`}>{overlay.caption.text}</p>
            )}
            {overlay.lap && <p className="cutscene__lap">{overlay.lap}</p>}
            {overlay.hud && (
              <div className="cutscene__hud">
                <span className="cutscene__speed">
                  {overlay.hud.speed}
                  <small> км/ч</small>
                </span>
                <span className="cutscene__heat" aria-label={`Температура мотора ${Math.round(overlay.hud.heat * 100)}%`}>
                  <span style={{ width: `${overlay.hud.heat * 100}%` }} data-hot={overlay.hud.heat > 0.8} />
                </span>
              </div>
            )}
            {overlay.photo && <p className="cutscene__photo">{overlay.photo}</p>}
            {overlay.dialogue && (
              <div className="cutscene__dialogue" data-side={overlay.dialogue.side}>
                <img src={overlay.dialogue.portrait} alt="" className="cutscene__dialogue-portrait" />
                <p>
                  <b>{overlay.dialogue.speaker}</b>
                  {overlay.dialogue.text}
                </p>
              </div>
            )}
            <div className="cutscene__bottom">
              {overlay.sound && <p className="cutscene__sound">{overlay.sound}</p>}
              {overlay.subtitle && (
                <p className="cutscene__subtitle">
                  {overlay.subtitle.speaker && <b>{overlay.subtitle.speaker}: </b>}
                  {overlay.subtitle.text}
                </p>
              )}
            </div>
            {phase === 'paused' && <p className="cutscene__paused">Пауза</p>}
          </div>
        )}
      </div>

      {phase !== 'ready' && (
        <div className="cutscene__controls">
          <button type="button" className="cutscene__control" onClick={togglePause}>
            {phase === 'paused' ? 'Продолжить' : 'Пауза'}
          </button>
          <button type="button" className="cutscene__control" onClick={() => finish(true)}>
            Пропустить →
          </button>
        </div>
      )}
    </div>
  )
}
