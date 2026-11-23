import { adminSession } from './session'
import { readApiEnvelope } from './api-response'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestWithRecovery<T>(path, init, true)
}

async function requestWithRecovery<T>(path: string, init: RequestInit, canRefresh: boolean): Promise<T> {
  let token = adminSession.getAccessToken()
  if (!token && await adminSession.ensureAccessToken()) token = adminSession.getAccessToken()
  if (!token) throw new Error('请先登录')

  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (response.status === 401 && canRefresh) {
    const refreshed = await adminSession.refresh()
    if (!refreshed) throw new Error('请先登录')
    return requestWithRecovery<T>(path, init, false)
  }

  return readApiEnvelope<T>(response)
}
