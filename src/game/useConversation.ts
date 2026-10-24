import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { topicKey, type Topic } from './dialogues.ts'
import { loadProgress, saveProgress } from './progress.ts'

const TYPE_SPEED = 45
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useConversation<M extends string>(speakerId: string, topics: Topic<M>[], idleMood: M) {
  const { user } = useAuth()
  const [asked, setAsked] = useState<string[]>(() => (user ? loadProgress(user.id).asked : []))
  const [topicId, setTopicId] = useState<string | null>(null)
  const [lineIndex, setLineIndex] = useState(0)
  const [chars, setChars] = useState(0)
  const [instant] = useState(reducedMotion)

  const topic = topics.find((item) => item.id === topicId) ?? null
  const line = topic?.lines[lineIndex]
  const shown = instant ? Infinity : chars
  const typing = line !== undefined && shown < line.text.length
  const finished = topic !== null && lineIndex === topic.lines.length - 1 && !typing
  const isAsked = (other: string) => asked.includes(topicKey(speakerId, other))

  const markHeard = (heardId: string) => {
    if (isAsked(heardId)) return
    const current = user ? loadProgress(user.id).asked : asked
    const next = [...new Set([...current, ...asked, topicKey(speakerId, heardId)])]
    setAsked(next)
    if (user) saveProgress(user.id, { asked: next })
  }

  const revealLine = (index: number) => {
    if (!topic) return
    setLineIndex(index)
    setChars(topic.lines[index].text.length)
    if (index === topic.lines.length - 1) markHeard(topic.id)
  }

  useEffect(() => {
    if (!line || !typing) return
    const timer = window.setTimeout(() => {
      if (chars + 1 >= line.text.length) revealLine(lineIndex)
      else setChars(chars + 1)
    }, 1000 / TYPE_SPEED)
    return () => window.clearTimeout(timer)
  })

  const advance = () => {
    if (!topic || !line) return
    if (typing) revealLine(lineIndex)
    else if (lineIndex < topic.lines.length - 1) {
      if (instant) revealLine(lineIndex + 1)
      else {
        setLineIndex(lineIndex + 1)
        setChars(0)
      }
    }
  }

  useEffect(() => {
    if (!topic || finished) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const start = (nextTopicId: string) => {
    setTopicId(nextTopicId)
    setLineIndex(0)
    setChars(0)
    const lines = topics.find((item) => item.id === nextTopicId)?.lines ?? []
    if (instant && lines.length === 1) markHeard(nextTopicId)
  }

  const spoken = topic ? topic.lines.slice(0, lineIndex + 1) : []
  const lastAnswer = [...spoken].reverse().find((item) => item.by === 'suspect')
  const mood: M = lastAnswer?.by === 'suspect' ? lastAnswer.mood : idleMood

  return {
    asked,
    isAsked,
    topic,
    spoken,
    lineIndex,
    shown,
    typing,
    finished,
    mood,
    advance,
    start,
    available: topics.filter((item) => !item.requires || isAsked(item.requires)),
    facts: topics.filter((item) => item.fact && isAsked(item.id)),
  }
}

export type Conversation<M extends string = string> = ReturnType<typeof useConversation<M>>
