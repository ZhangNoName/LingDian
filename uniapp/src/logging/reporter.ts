import { createClientLogReporter } from '@lingdian/observability'
import { customerAuth } from '../services/auth'
import { API_BASE } from '../config/api'

const reporter = createClientLogReporter('MINIAPP', (event) => new Promise<void>((resolve, reject) => {
  uni.request({
    url: `${API_BASE}/system-logs/client-events`,
    method: 'POST',
    header: { 'Content-Type': 'application/json', ...(customerAuth.getAccessToken() ? { Authorization: `Bearer ${customerAuth.getAccessToken()}` } : {}) },
    data: event,
    success: (response) => response.statusCode === 202 ? resolve() : reject(new Error(`Log endpoint returned ${response.statusCode}`)),
    fail: reject,
  })
}))

export const reportMiniAppError = reporter.report

export function installMiniAppErrorReporter() {
  uni.onError((error) => reporter.report(error, 'MINIAPP_ERROR'))
}
