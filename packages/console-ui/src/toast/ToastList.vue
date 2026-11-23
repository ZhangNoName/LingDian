<script setup lang="ts">
import { ToastClose, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui'
import { X } from '@lingdian/icons/web'
import { IconButton } from '../button'

defineProps<{ items: readonly { id: number; text: string; tone: 'success' | 'warning' | 'error' }[] }>()
const emit = defineEmits<{ dismiss: [id: number] }>()
</script>

<template>
  <ToastProvider label="通知">
    <ToastRoot
      v-for="item in items"
      :key="item.id"
      default-open
      :type="item.tone === 'error' ? 'foreground' : 'background'"
      data-slot="toast"
      class="flex items-center justify-between gap-3 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
      :class="{
        'border-emerald-500/50': item.tone === 'success',
        'border-amber-500/50': item.tone === 'warning',
        'border-destructive/50': item.tone === 'error',
      }"
      @update:open="!$event && emit('dismiss', item.id)"
    >
      <ToastTitle>{{ item.text }}</ToastTitle>
      <ToastClose as-child>
        <IconButton :icon="X" class="pointer-events-auto" label="关闭通知" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport class="pointer-events-none fixed top-18 left-1/2 z-[60] flex w-96 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 sm:top-4" />
  </ToastProvider>
</template>
