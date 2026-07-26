const CHINESE_TEXT = /[\u3400-\u9fff]/

export function getAdminAuthMessage(error: unknown): string {
  const source = error instanceof Error ? error.message.trim() : ''
  const normalized = source.toLowerCase()

  if (normalized.includes('account credentials are invalid')) {
    return '账号或密码错误，请重新输入。'
  }
  if (
    normalized.includes('please sign in again') ||
    normalized.includes('token expired') ||
    normalized.includes('session expired') ||
    normalized.includes('refresh expired')
  ) {
    return '登录状态已失效，请重新登录。'
  }
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network request failed') ||
    normalized.includes('network error')
  ) {
    return '网络连接异常，请检查网络后重试。'
  }
  if (source && CHINESE_TEXT.test(source)) return source
  return '登录失败，请稍后重试。'
}
