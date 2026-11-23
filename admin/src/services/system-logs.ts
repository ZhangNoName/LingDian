import type { SystemLogPage, SystemLogQuery } from '@lingdian/contracts'
import { adminRequest } from '../auth/api-client'

export function getSystemLogs(query: SystemLogQuery): Promise<SystemLogPage> {
  return adminRequest(buildSystemLogPath(query))
}

export function buildSystemLogPath(query: SystemLogQuery): string {
  const search = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })
  if (query.source) search.set('source', query.source)
  if (query.level) search.set('level', query.level)
  if (query.from) search.set('from', query.from)
  if (query.to) search.set('to', query.to)
  return `/admin/system-logs?${search.toString()}`
}
