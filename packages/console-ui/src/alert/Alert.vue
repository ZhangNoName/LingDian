<script setup lang="ts">
defineProps<{ variant?: 'danger' | 'warning' }>()
</script>

<template>
  <div
    data-slot="alert"
    role="alert"
    class="relative flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm"
    :class="variant === 'warning' ? 'border-amber-500/40 text-amber-800 dark:text-amber-300' : 'text-destructive'"
  >
    <slot />
  </div>
</template>
