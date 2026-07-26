import { ref } from 'vue'

export function createNavigationState() {
  const isDesktopCollapsed = ref(false)
  const isMobileOpen = ref(false)

  return {
    isDesktopCollapsed,
    isMobileOpen,
    toggleDesktop() {
      isDesktopCollapsed.value = !isDesktopCollapsed.value
    },
    openMobile() {
      isMobileOpen.value = true
    },
    closeMobile() {
      isMobileOpen.value = false
    },
  }
}
