import { RES_CODE } from '@lingdian/common'

const CHINESE_TEXT = /[\u3400-\u9fff]/

export function getCustomerAuthMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined
  const source = error instanceof Error
    ? error.message.trim()
    : typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.trim()
      : ''
  const normalized = source.toLowerCase()

  if (code === RES_CODE.LEGAL_CONSENT_UPDATE_REQUIRED) {
    return '请更新小程序后重试'
  }
  if (
    normalized.includes('current user agreement and privacy policy') ||
    normalized.includes('legal agreement version is outdated') ||
    normalized.includes('update the mini program')
  ) {
    return '请更新小程序后重试'
  }
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
