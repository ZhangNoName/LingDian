import { merchantSession } from './session'

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, requestInit(init))
  if (response.status !== 401) return response

  if (!(await merchantSession.refresh())) return response

  const retryResponse = await fetch(input, requestInit(init))
  if (retryResponse.status === 401) await merchantSession.handleUnauthorized()
  return retryResponse
}

function requestInit(init: RequestInit | undefined): RequestInit {
  const headers = new Headers(init?.headers)
  const token = merchantSession.getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return { ...init, headers, credentials: 'include' }
}
