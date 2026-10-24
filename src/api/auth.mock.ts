import { ApiError } from './http.ts'
import type { AuthApi, AuthResponse, User } from './types.ts'

const USERS_KEY = 'last-lap:mock-users'
const TOKENS_KEY = 'last-lap:mock-tokens'
const LATENCY_MS = 400

interface StoredUser extends User {
  passwordHash: string
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
  }
}

const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS))

async function hash(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const toPublic = ({ passwordHash: _passwordHash, ...user }: StoredUser): User => user

function issueToken(userId: string): string {
  const token = crypto.randomUUID()
  const tokens = readJson<Record<string, string>>(TOKENS_KEY, {})
  tokens[token] = userId
  writeJson(TOKENS_KEY, tokens)
  return token
}

export const mockAuthApi: AuthApi = {
  async register({ nickname, password }): Promise<AuthResponse> {
    await delay()
    const users = readJson<StoredUser[]>(USERS_KEY, [])
    if (users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) {
      throw new ApiError(409, 'Этот никнейм уже занят')
    }
    const user: StoredUser = {
      id: crypto.randomUUID(),
      nickname,
      createdAt: new Date().toISOString(),
      passwordHash: await hash(password),
    }
    writeJson(USERS_KEY, [...users, user])
    return { token: issueToken(user.id), user: toPublic(user) }
  },

  async login({ nickname, password }): Promise<AuthResponse> {
    await delay()
    const users = readJson<StoredUser[]>(USERS_KEY, [])
    const user = users.find((u) => u.nickname.toLowerCase() === nickname.toLowerCase())
    if (!user || user.passwordHash !== (await hash(password))) {
      throw new ApiError(401, 'Неверный никнейм или пароль')
    }
    return { token: issueToken(user.id), user: toPublic(user) }
  },

  async me(token): Promise<User> {
    const userId = readJson<Record<string, string>>(TOKENS_KEY, {})[token]
    const user = readJson<StoredUser[]>(USERS_KEY, []).find((u) => u.id === userId)
    if (!user) throw new ApiError(401, 'Сессия истекла')
    return toPublic(user)
  },

  async logout(token): Promise<void> {
    const tokens = readJson<Record<string, string>>(TOKENS_KEY, {})
    delete tokens[token]
    writeJson(TOKENS_KEY, tokens)
  },
}
