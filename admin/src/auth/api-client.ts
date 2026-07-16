import { adminSession } from './session'

type ApiEnvelope<T> = { code: number; msg: string; data: T }

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestWithRecovery<T>(path, init, true)
}

async function requestWithRecovery<T>(path: string, init: RequestInit, canRefresh: boolean): Promise<T> {
  const token = adminSession.getAccessToken()
  if (!token) throw new Error('请先登录')

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  if (response.status === 401 && canRefresh) {
    const refreshed = await adminSession.refresh()
    if (!refreshed) throw new Error('请先登录')
    return requestWithRecovery<T>(path, init, false)
  }

  const envelope = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || envelope.code !== 0) throw new Error(envelope.msg || '请求失败')
  return envelope.data
}
