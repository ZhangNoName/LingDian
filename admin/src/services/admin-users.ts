import type { PlatformUserDetail, PlatformUserPage, PlatformUserQuery } from '@lingdian/contracts'
import { adminRequest } from '../auth/api-client'
export function listUsers(query: PlatformUserQuery) { const params = new URLSearchParams(); Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) }); return adminRequest<PlatformUserPage>(`/admin/users?${params}`) }
export function getUser(userId: string) { return adminRequest<PlatformUserDetail>(`/admin/users/${userId}`) }
