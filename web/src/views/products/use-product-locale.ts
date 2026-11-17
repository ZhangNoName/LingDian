import { useLocale } from '@/i18n/locale'
import { en, zh, type ProductMessageKey } from './messages'
export function useProductLocale() {
  const { locale } = useLocale()
  return {
    locale,
    t: (key: ProductMessageKey) => (locale.value === 'en-US' ? en : zh)[key],
    money: (value: number) =>
      new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: 'CNY',
        currencyDisplay: 'narrowSymbol',
      }).format(value),
  }
}
