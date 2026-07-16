import { RES_CODE, isResponseEnvelope, type ResponseEnvelope } from '@lingdian/common'
import type { AuthTokens, AuthenticatedUser } from '@lingdian/contracts'

let accessToken: string | undefined
let accessTokenExpiresAt = 0
let currentUser: AuthenticatedUser | undefined
let unauthorizedHandler: () => void | Promise<void> = redirectBrowserToLogin

export const merchantSession = {
  acceptLogin(tokens: AuthTokens): void {
    if (!isMerchantSession(tokens.user)) {
      this.clear()
      throw new Error('Merchant session required.')
    }
    accessToken = tokens.access_token
    accessTokenExpiresAt = Date.now() + tokens.expires_in * 1000
    currentUser = tokens.user
  },

  getAccessToken(): string | undefined {
    if (!accessToken || Date.now() >= accessTokenExpiresAt) return undefined
    return accessToken
  },

  getUser(): AuthenticatedUser | undefined {
    return currentUser
  },

  clear(): void {
    accessToken = undefined
    accessTokenExpiresAt = 0
    currentUser = undefined
  },

  setUnauthorizedHandler(handler: () => void | Promise<void>): void {
    unauthorizedHandler = handler
  },

  async handleUnauthorized(): Promise<void> {
    this.clear()
    await unauthorizedHandler()
  },

  async login(username: string, password: string): Promise<void> {
    const response = await fetch('/api/auth/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, audience: 'merchant-api' }),
    })

    this.acceptLogin(await readAuthTokens(response))
  },

  async requestPasswordReset(username: string): Promise<void> {
    const response = await fetch('/api/auth/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, audience: 'merchant-api' }),
    })

    if (!response.ok) throw new Error(await readErrorMessage(response))
  },

  async resetPassword(username: string, code: string, password: string): Promise<void> {
    const response = await fetch('/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, code, password, audience: 'merchant-api' }),
    })

    if (!response.ok) throw new Error(await readErrorMessage(response))
    this.clear()
  },

  async requestPasswordChangeCode(): Promise<void> {
    const token = this.getAccessToken()
    if (!token) throw new Error('Please sign in again.')

    const response = await fetch('/api/auth/password/change/code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })

    if (!response.ok) throw new Error(await readErrorMessage(response))
  },

  async changePassword(code: string, password: string): Promise<void> {
    const token = this.getAccessToken()
    if (!token) throw new Error('Please sign in again.')

    const response = await fetch('/api/auth/password/change', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, password }),
    })

    if (!response.ok) throw new Error(await readErrorMessage(response))
    this.clear()
  },

  async updateNickname(nickname: string): Promise<{ nickname: string }> {
    const token = this.getAccessToken()
    if (!token) throw new Error('Please sign in again.')

    const response = await fetch('/api/auth/profile/nickname', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nickname }),
    })

    const body = (await response.json()) as ResponseEnvelope<{ nickname: string }> | { nickname: string }
    if (!response.ok) throw new Error(readMessage(body) ?? 'Unable to update nickname.')
    if (isResponseEnvelope<{ nickname: string }>(body)) {
      if (body.code !== RES_CODE.SUCCESS || !body.data) throw new Error(body.msg || 'Unable to update nickname.')
      return body.data
    }
    return body
  },

  async refresh(): Promise<boolean> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{}',
    })

    if (response.status === 401) {
      await this.handleUnauthorized()
      return false
    }

    const tokens = await readAuthTokens(response)
    try {
      this.acceptLogin(tokens)
      return true
    } catch {
      await this.handleUnauthorized()
      return false
    }
  },

  async logout(): Promise<void> {
    const token = this.getAccessToken()

    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })
      }
    } finally {
      this.clear()
    }
  },

  async ensureAccessToken(): Promise<boolean> {
    return Boolean(this.getAccessToken()) || this.refresh()
  },
}

function isMerchantSession(user: AuthenticatedUser): boolean {
  return user.audience === 'merchant-api' && user.roles.includes('MERCHANT')
}

function redirectBrowserToLogin(): void {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

async function readAuthTokens(response: Response): Promise<AuthTokens> {
  const body = (await response.json()) as ResponseEnvelope<AuthTokens> | AuthTokens

  if (!response.ok) {
    throw new Error(readMessage(body) ?? 'Authentication request failed.')
  }

  if (isResponseEnvelope<AuthTokens>(body)) {
    if (body.code !== RES_CODE.SUCCESS || !body.data) {
      throw new Error(body.msg || 'Authentication request failed.')
    }
    return body.data
  }

  return body
}

function readMessage(body: unknown): string | undefined {
  return isResponseEnvelope<unknown>(body) ? body.msg : undefined
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; msg?: string }
    return body.message || body.msg || 'Authentication request failed.'
  } catch {
    return 'Authentication request failed.'
  }
}
