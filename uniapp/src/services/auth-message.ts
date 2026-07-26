const CHINESE_TEXT = /[\u3400-\u9fff]/

export function getCustomerAuthMessage(error: unknown): string {
  const source = error instanceof Error ? error.message.trim() : ''
  const normalized = source.toLowerCase()

  if (normalized.includes('verification code') && (normalized.includes('invalid') || normalized.includes('expired'))) {
    return '验证码错误或已失效，请重新获取。'
  }
  if (
    normalized.includes('network request failed') ||
    normalized.includes('network error') ||
    normalized.includes('failed to fetch')
  ) {
    return '网络连接异常，请检查网络后重试。'
  }
  if (normalized.includes('does not support the selected sign-in provider')) {
    return '当前环境暂不支持该登录方式。'
  }
  if (source && CHINESE_TEXT.test(source)) return source
  return '登录失败，请稍后重试。'
}
