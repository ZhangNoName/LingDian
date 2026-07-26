import type { AuthTokens, AuthenticatedUser } from '@lingdian/contracts'
import { ref } from 'vue'
import { readApiEnvelope } from './api-response'

const accessToken = ref<string>()
const currentUser = ref<AuthenticatedUser>()
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function postTokens(path: string, body: object): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return readApiEnvelope<AuthTokens>(response)
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
