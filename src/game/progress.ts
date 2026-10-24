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

export function saveProgress(userId: string, patch: Partial<Progress>): Progress {
  const next = { ...loadProgress(userId), ...patch }
  try {
    localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
  }
  return next
}
