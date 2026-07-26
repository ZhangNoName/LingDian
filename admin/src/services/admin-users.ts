import type { CreatePlatformUserRequest, PlatformUserDetail, PlatformUserPage, PlatformUserQuery, PlatformUserStatus, UpdatePlatformUserRequest } from '@lingdian/contracts'
import { adminRequest } from '../auth/api-client'
export function listUsers(query: PlatformUserQuery) { const params = new URLSearchParams(); Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) }); return adminRequest<PlatformUserPage>(`/admin/users?${params}`) }
export function getUser(userId: string) { return adminRequest<PlatformUserDetail>(`/admin/users/${userId}`) }
export function setUserStatus(userId: string, status: PlatformUserStatus) { return adminRequest<void>(`/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }) }
export function createUser(input: CreatePlatformUserRequest) { return adminRequest<void>('/admin/users', { method: 'POST', body: JSON.stringify(input) }) }
export function updateUser(userId: string, input: UpdatePlatformUserRequest) { return adminRequest<void>(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function resetUserPassword(userId: string, password: string) { return adminRequest<void>(`/admin/users/${userId}/password-reset`, { method: 'POST', body: JSON.stringify({ password }) }) }
export function listStoreOptions() { return adminRequest<Array<{ id: string; name: string }>>('/admin/users/options/stores') }
export function changeCurrentPassword(currentPassword: string, password: string) { return adminRequest<void>('/auth/account/password-change', { method: 'POST', body: JSON.stringify({ currentPassword, password }) }) }
