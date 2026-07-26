import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createThemeController, THEME_STORAGE_KEY } from './theme'

describe('theme controller', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.className = '' })

  it('persists an explicit dark theme and updates the root class', () => {
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const theme = createThemeController(() => media as never)
    theme.setPreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('follows live system changes only in system mode', () => {
    let listener: ((event: { matches: boolean }) => void) | undefined
    const media = { matches: false, addEventListener: (_: string, value: typeof listener) => { listener = value }, removeEventListener: vi.fn() }
    const theme = createThemeController(() => media as never)
    theme.setPreference('system')
    listener?.({ matches: true })
    expect(theme.resolvedTheme.value).toBe('dark')
    theme.setPreference('light')
    listener?.({ matches: true })
    expect(theme.resolvedTheme.value).toBe('light')
  })
})
