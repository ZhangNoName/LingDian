import { readonly, ref } from 'vue'

type Tone = 'success' | 'warning' | 'error'
const items = ref<{ id: number; text: string; tone: Tone }[]>([])
let nextId = 0

function notify(tone: Tone, text: string) {
  items.value.push({ id: ++nextId, text, tone })
}

export const notifications = {
  items: readonly(items),
  dismiss: (id: number) => { items.value = items.value.filter((item) => item.id !== id) },
  success: (text: string) => notify('success', text),
  warning: (text: string) => notify('warning', text),
  error: (text: string) => notify('error', text),
}
