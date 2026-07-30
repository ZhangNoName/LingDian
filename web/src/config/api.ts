const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

export function resolveApiUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/api/') ? path.slice(4) : path
  return `${normalizedBase}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`
}

export function apiUrl(path: string): string {
  return resolveApiUrl(API_BASE, path)
}
