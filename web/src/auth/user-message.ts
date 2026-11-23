import { accountZh, accountEn, type AccountKey } from '@/i18n/account'
import type { Locale } from '@/i18n/locale'
export function merchantAuthErrorKey(error: unknown, fallback: AccountKey = 'loginFailed'): AccountKey {
  const text = error instanceof Error ? error.message.trim().toLowerCase() : ''
  if (text.includes('account credentials are invalid')) return 'credentials'
  if (
    text.includes('merchant session required') ||
    text.includes('merchant role required') ||
    text.includes('merchant audience required')
  )
    return 'forbidden'
  if (text.includes('verification code is invalid or expired') || /验证码.*(过期|错误|无效)/.test(text))
    return 'codeInvalid'
  if (text.includes('too many verification codes') || text.includes('too many requests')) return 'codeLimit'
  if (text.includes('verified merchant phone identity')) return 'phoneRequired'
  if (text.includes('password must be at least')) return 'passwordShort'
  if (text.includes('nickname must contain')) return 'nicknameInvalid'
  if (
    [
      'please sign in again',
      'token expired',
      'session expired',
      'refresh expired',
      'session is inactive or expired',
    ].some((value) => text.includes(value))
  )
    return 'expired'
  if (['failed to fetch', 'network request failed', 'network error'].some((value) => text.includes(value)))
    return 'network'
  return fallback
}
export function getMerchantAuthMessage(
  error: unknown,
  locale: Locale = 'zh-CN',
  fallback: AccountKey = 'loginFailed',
): string {
  return (locale === 'en-US' ? accountEn : accountZh)[merchantAuthErrorKey(error, fallback)]
}
