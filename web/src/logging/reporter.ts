import { createClientLogReporter, installBrowserErrorReporter } from '@lingdian/observability'
import { merchantSession } from '../auth/session'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

const reporter = createClientLogReporter('MERCHANT_WEB', async (event) => {
  await fetch(`${API_BASE}/system-logs/client-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(merchantSession.getAccessToken() ? { Authorization: `Bearer ${merchantSession.getAccessToken()}` } : {}) },
    body: JSON.stringify(event),
    keepalive: true,
  })
})

export const reportMerchantError = reporter.report
export const installMerchantErrorReporter = () => installBrowserErrorReporter(reporter)
