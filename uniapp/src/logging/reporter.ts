import { createClientLogReporter } from '@lingdian/observability'
import { customerAuth } from '../services/auth'
import { buildApiUrl } from '../config/api'

const reporter = createClientLogReporter('MINIAPP', (event) => new Promise<void>((resolve, reject) => {
  const token = customerAuth.getAccessToken()
  uni.request({
    url: buildApiUrl('/system-logs/client-events'),
    method: 'POST',
    header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    data: event,
    success: (response) => response.statusCode === 202 ? resolve() : reject(new Error(`Log endpoint returned ${response.statusCode}`)),
    fail: reject,
  })
}))

export const reportMiniAppError = reporter.report

export function installMiniAppErrorReporter() {
  uni.onError((error) => reporter.report(error, 'MINIAPP_ERROR'))
}
