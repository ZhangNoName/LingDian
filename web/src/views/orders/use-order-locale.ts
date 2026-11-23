import { useLocale } from '@/i18n/locale'
import { en, zh, type OrderMessageKey } from './messages'
import { formatDateTime, orderSourceLabel, orderTypeLabel, paymentChannelLabel, statusLabel } from './order-presentation'
export function useOrderLocale() {
  const { locale } = useLocale()
  return {
    locale, t: (key: OrderMessageKey) => (locale.value === 'en-US' ? en : zh)[key],
    status: (value: string) => statusLabel(value, locale.value), type: (value: string) => orderTypeLabel(value, locale.value),
    channel: (value: string | undefined) => paymentChannelLabel(value, locale.value), source: (value: string | null) => orderSourceLabel(value, locale.value),
    date: (value: string | null | undefined) => formatDateTime(value ?? undefined, locale.value),
    money: (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'CNY', currencyDisplay: 'narrowSymbol' }).format(value) : '—',
  }
}
