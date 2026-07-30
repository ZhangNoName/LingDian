import { merchantSession } from './session'
import { apiUrl } from '../config/api'

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = normalizeInput(input)
  const response = await fetch(request, requestInit(init))
  if (response.status !== 401) return response

  if (!(await merchantSession.refresh())) return response

  const retryResponse = await fetch(request, requestInit(init))
  if (retryResponse.status === 401) await merchantSession.handleUnauthorized()
  return retryResponse
}

function normalizeInput(input: RequestInfo | URL): RequestInfo | URL {
  return typeof input === 'string' && input.startsWith('/api/') ? apiUrl(input) : input
}

function requestInit(init: RequestInit | undefined): RequestInit {
  const headers = new Headers(init?.headers)
  const token = merchantSession.getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return { ...init, headers, credentials: 'include' }
}
