import { createClientLogReporter, installBrowserErrorReporter } from '@lingdian/observability'
import { adminSession } from '../auth/session'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

const reporter = createClientLogReporter('ADMIN_WEB', async (event) => {
  await fetch(`${API_BASE}/system-logs/client-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(adminSession.getAccessToken() ? { Authorization: `Bearer ${adminSession.getAccessToken()}` } : {}) },
    body: JSON.stringify(event),
    keepalive: true,
  })
})

export const reportAdminError = reporter.report
export const installAdminErrorReporter = () => installBrowserErrorReporter(reporter)
