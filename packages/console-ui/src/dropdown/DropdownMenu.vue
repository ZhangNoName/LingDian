<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'

defineProps<{
  items: readonly { value: string; label: string; divided?: boolean }[]
  align?: 'start' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
}>()
const emit = defineEmits<{ select: [value: string] }>()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child><slot /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        data-slot="dropdown-menu-content"
        :align="align ?? 'end'"
        :side="side ?? 'bottom'"
        :side-offset="4"
        class="z-50 max-h-(--reka-dropdown-menu-content-available-height) min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 data-open:zoom-in-95 data-closed:zoom-out-95"
      >
        <template v-for="item in items" :key="item.value">
          <DropdownMenuSeparator v-if="item.divided" class="-mx-1 my-1 h-px bg-border" />
          <DropdownMenuItem
            data-slot="dropdown-menu-item"
            class="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground"
            @select="emit('select', item.value)"
          >
            {{ item.label }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
