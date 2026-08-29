import { ref } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'lingdian-admin-theme'

type MediaFactory = () => MediaQueryList

function storedPreference(): ThemePreference {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function createThemeController(mediaFactory: MediaFactory = () => matchMedia('(prefers-color-scheme: dark)')) {
  const media = mediaFactory()
  const preference = ref<ThemePreference>(storedPreference())
  const resolvedTheme = ref<ResolvedTheme>(preference.value === 'system' ? (media.matches ? 'dark' : 'light') : preference.value)

  function apply() {
    resolvedTheme.value = preference.value === 'system' ? (media.matches ? 'dark' : 'light') : preference.value
    document.documentElement.classList.toggle('dark', resolvedTheme.value === 'dark')
    document.documentElement.classList.toggle('light', resolvedTheme.value === 'light')
    document.documentElement.style.colorScheme = resolvedTheme.value
  }

  function onSystemChange(event: MediaQueryListEvent | { matches: boolean }) {
    if (preference.value !== 'system') return
    resolvedTheme.value = event.matches ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', resolvedTheme.value === 'dark')
    document.documentElement.classList.toggle('light', resolvedTheme.value === 'light')
    document.documentElement.style.colorScheme = resolvedTheme.value
  }

  function setPreference(value: ThemePreference) {
    preference.value = value
    localStorage.setItem(THEME_STORAGE_KEY, value)
    apply()
  }

  media.addEventListener('change', onSystemChange)
  apply()
  return { preference, resolvedTheme, setPreference }
}

let themeController: ReturnType<typeof createThemeController> | undefined
export function useTheme() {
  themeController ??= createThemeController()
  return themeController
}
