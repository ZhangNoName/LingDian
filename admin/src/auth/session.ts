import type { AuthTokens, AuthenticatedUser } from '@lingdian/contracts'
import { ref } from 'vue'

type ApiEnvelope<T> = { code: number; msg: string; data: T }

const accessToken = ref<string>()
const currentUser = ref<AuthenticatedUser>()
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function readEnvelope<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || envelope.code !== 0) throw new Error(envelope.msg || '请求失败')
  return envelope.data
}

async function postTokens(path: string, body: object): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return readEnvelope<AuthTokens>(response)
}

export const adminSession = {
  accessToken,
  currentUser,

  getAccessToken() {
    return accessToken.value
  },

  acceptLogin(tokens: AuthTokens) {
    accessToken.value = tokens.access_token
    currentUser.value = tokens.user
  },

  async login(username: string, password: string) {
    const tokens = await postTokens('/auth/account/login', { username, password, audience: 'admin-api' })
    this.acceptLogin(tokens)
  },

  async refresh(): Promise<boolean> {
    try {
      const tokens = await postTokens('/auth/refresh', {})
      this.acceptLogin(tokens)
      return true
    } catch {
      this.clear()
      return false
    }
  },

  async ensureAccessToken(): Promise<boolean> {
    return accessToken.value ? true : this.refresh()
  },

  clear() {
    accessToken.value = undefined
    currentUser.value = undefined
  },

  async logout() {
    const token = accessToken.value
    try {
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })
      }
    } finally {
      this.clear()
    }
  },
}
