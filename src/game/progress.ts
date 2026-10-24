import { API_URL, request } from '../api/http.ts'
import { readToken } from '../auth/token.ts'

export interface Progress {
  introSeen: boolean
  examined: string[]
  asked: string[]
}

const empty: Progress = { introSeen: false, examined: [], asked: [] }
const key = (userId: string) => `last-lap:progress:${userId}`

export function loadProgress(userId: string): Progress {
  try {
    const raw = localStorage.getItem(key(userId))
    return raw ? { ...empty, ...(JSON.parse(raw) as Partial<Progress>) } : empty
  } catch {
    return empty
  }
}

function writeProgress(userId: string, progress: Progress) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(progress))
  } catch {
    return
  }
}

let outbox: Promise<unknown> = Promise.resolve()

function pushProgress(patch: Partial<Progress>) {
  const token = readToken()
  if (!API_URL || !token) return
  outbox = outbox.then(() => request<Progress>('/progress', { method: 'PUT', body: patch, token }).catch(() => undefined))
}

export function saveProgress(userId: string, patch: Partial<Progress>): Progress {
  const next = { ...loadProgress(userId), ...patch }
  writeProgress(userId, next)
  pushProgress(patch)
  return next
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]

export async function syncProgress(userId: string, token: string) {
  if (!API_URL) return
  try {
    const server = await request<Progress>('/progress', { token })
    const local = loadProgress(userId)
    const merged: Progress = {
      introSeen: server.introSeen || local.introSeen,
      examined: union(server.examined, local.examined),
      asked: union(server.asked, local.asked),
    }
    writeProgress(userId, merged)
    if (JSON.stringify(merged) !== JSON.stringify(server)) {
      await request<Progress>('/progress', { method: 'PUT', body: merged, token })
    }
  } catch {
    return
  }
}
