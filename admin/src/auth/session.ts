import type { AuthTokens, AuthenticatedUser } from '@lingdian/contracts'
import { ref } from 'vue'
import { readApiEnvelope } from './api-response'

const accessToken = ref<string>()
const currentUser = ref<AuthenticatedUser>()
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
const DEVICE_STORAGE_KEY = 'lingdian-admin-device-id'
let refreshPromise: Promise<boolean> | undefined

async function postTokens(path: string, body: object): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
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
    if (refreshPromise) return refreshPromise
    refreshPromise = withBrowserRefreshLock('lingdian-admin-refresh', refreshAdminSession).finally(() => {
      refreshPromise = undefined
    })
    return refreshPromise
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
          headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId() },
          credentials: 'include',
        })
      }
    } finally {
      this.clear()
    }
  },
}

async function refreshAdminSession(): Promise<boolean> {
  try {
    const tokens = await postTokens('/auth/refresh', {})
    adminSession.acceptLogin(tokens)
    return true
  } catch {
    adminSession.clear()
    return false
  }
}

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Device-Id': deviceId() }
}

function deviceId(): string {
  const existing = localStorage.getItem(DEVICE_STORAGE_KEY)
  if (existing) return existing
  const created = globalThis.crypto?.randomUUID?.() ?? `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`
  localStorage.setItem(DEVICE_STORAGE_KEY, created)
  return created
}


function withBrowserRefreshLock(name: string, operation: () => Promise<boolean>): Promise<boolean> {
  return navigator.locks?.request
    ? navigator.locks.request(name, operation) as unknown as Promise<boolean>
    : operation()
}
