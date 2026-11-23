<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDownIcon } from '@lingdian/icons/web'
import { Button } from '../button'
import Collapsible from './Collapsible.vue'

const open = ref(false)
</script>

<template>
  <Collapsible v-model:open="open">
    <template #trigger>
      <Button
        type="button"
        variant="ghost"
        class="h-auto min-h-8 w-full justify-between gap-2 whitespace-normal px-0 text-start text-inherit hover:bg-transparent"
      >
        <span class="min-w-0 break-words"><slot name="label" /></span>
        <ChevronDownIcon aria-hidden="true" class="size-4 shrink-0 transition-transform" :class="{ 'rotate-180': open }" />
      </Button>
    </template>
    <slot />
  </Collapsible>
</template>
