<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CheckIcon } from '@lingdian/icons/web'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { cn } from '../utils'

defineProps<{ class?: HTMLAttributes['class'] }>()
const checked = defineModel<boolean>({ required: true })
</script>

<template>
  <CheckboxRoot
    data-slot="checkbox"
    :model-value="checked"
    :class="cn(
      'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50',
      $props.class,
    )"
    @update:model-value="checked = $event === true"
  >
    <CheckboxIndicator data-slot="checkbox-indicator" class="grid place-content-center text-current">
      <CheckIcon class="size-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
