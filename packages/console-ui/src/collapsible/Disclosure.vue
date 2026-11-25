<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ChevronDownIcon } from '@lingdian/icons/web'
import { Button } from '../button'
import { cn } from '../utils'
import Collapsible from './Collapsible.vue'

defineProps<{ triggerClass?: HTMLAttributes['class'] }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Collapsible v-model:open="open">
    <template #trigger>
      <Button
        type="button"
        variant="ghost"
        :class="cn('h-auto min-h-8 w-full justify-between gap-2 whitespace-normal px-0 text-start text-inherit hover:bg-transparent', triggerClass)"
      >
        <span class="min-w-0 break-words"><slot name="label" /></span>
        <ChevronDownIcon aria-hidden="true" class="size-4 shrink-0 transition-transform" :class="{ 'rotate-180': open }" />
      </Button>
    </template>
    <slot />
  </Collapsible>
</template>
