import { ref, watch } from 'vue'
export type Locale = 'zh-CN' | 'en-US'
function readLocale(): Locale {
  try { return localStorage.getItem('lingdian.locale') === 'en-US' ? 'en-US' : 'zh-CN' } catch { return 'zh-CN' }
}
const locale = ref<Locale>(readLocale())
watch(locale, (value) => {
  try { localStorage.setItem('lingdian.locale', value) } catch { /* Storage may be disabled. */ }
})
export function useLocale() { return { locale } }
