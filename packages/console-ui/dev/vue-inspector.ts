const holdOption = process.platform === 'darwin'

export const vueInspectorOptions = {
  toggleComboKey: holdOption ? false as const : 'alt',
  toggleButtonVisibility: 'never' as const,
  disableInspectorOnEditorOpen: !holdOption,
  launchEditor: 'code',
  viteDevtools: false,
}

const holdOptionScript = `
  const optionListeners = new AbortController()
  const captureOption = { capture: true, signal: optionListeners.signal }

  function stopInspecting() {
    client.disable()
    lastMatchedElement.value = undefined
  }

  function syncOption(event) {
    if (event.altKey) client.enable()
    else if (client.enabled) stopInspecting()
  }

  window.addEventListener('keydown', syncOption, captureOption)
  window.addEventListener('keyup', syncOption, captureOption)
  window.addEventListener('pointermove', syncOption, { ...captureOption, passive: true })
  window.addEventListener('click', syncOption, captureOption)
  window.addEventListener('blur', stopInspecting, { signal: optionListeners.signal })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopInspecting()
  }, { signal: optionListeners.signal })

  import.meta.hot?.dispose(() => optionListeners.abort())
`

export function holdOptionInspector() {
  return {
    name: 'lingdian:hold-option-inspector',
    enforce: 'post' as const,
    apply(_config: unknown, { command }: { command: string }) {
      return holdOption && command === 'serve' && process.env.NODE_ENV !== 'test'
    },
    transform(code: string, id: string) {
      // Use the overlay's own hover cache so re-entering the same element highlights it.
      if (id.split('?')[0]?.endsWith('/vite-plugin-vue-inspector/src/client/overlay.ts')) {
        return { code: `${code}\n${holdOptionScript}`, map: null }
      }
    },
  }
}
