<script setup lang="ts">
import { computed } from 'vue'
import { CheckIcon, ChevronDownIcon, X } from '@lingdian/icons/web'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { Button, IconButton } from '../button'
import { Input } from '../input'

const props = defineProps<{
  options: readonly { value: string; label: string; disabled?: boolean }[]
  label: string
  placeholder?: string
  multiple?: boolean
  clearable?: boolean
  disabled?: boolean
}>()
const model = defineModel<string | string[] | null>({ required: true })
const selected = computed(() => Array.isArray(model.value) ? model.value : [])
const labelFor = (value: string) => props.options.find((option) => option.value === value)?.label ?? value
const displayValue = (value: unknown) => typeof value === 'string' ? labelFor(value) : ''

function updateValue(value: unknown) {
  if (value == null || typeof value === 'string') model.value = value ?? null
  else if (Array.isArray(value)) model.value = value.filter((item): item is string => typeof item === 'string')
}

function clear() {
  model.value = props.multiple ? [] : null
}
</script>

<template>
  <ComboboxRoot
    :model-value="model"
    :multiple="multiple"
    :disabled="disabled"
    open-on-click
    class="grid min-w-0 gap-1"
    @update:model-value="updateValue"
  >
    <ComboboxAnchor as-child>
      <div class="grid min-w-0 gap-1">
        <div data-slot="input-group" class="flex min-w-0 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          <ComboboxInput as-child :display-value="displayValue" :placeholder="placeholder" :aria-label="label">
            <Input class="min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0 dark:bg-transparent" />
          </ComboboxInput>
          <IconButton v-if="clearable && (multiple ? selected.length : model)" :icon="X" :disabled="disabled" label="清除" @click="clear" />
          <ComboboxTrigger as-child>
            <IconButton :icon="ChevronDownIcon" :disabled="disabled" :label="`展开${label}`" />
          </ComboboxTrigger>
        </div>
        <div v-if="selected.length" class="flex flex-wrap gap-1">
          <Button
            v-for="value in selected"
            :key="value"
            type="button"
            variant="outline"
            size="sm"
            :disabled="disabled"
            :aria-label="`移除 ${labelFor(value)}`"
            @click="model = selected.filter((item) => item !== value)"
          >
            {{ labelFor(value) }} <X />
          </Button>
        </div>
      </div>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent
        data-slot="combobox-list"
        position="popper"
        :side-offset="4"
        class="z-50 w-(--reka-combobox-trigger-width) max-w-(--reka-combobox-content-available-width) origin-(--reka-combobox-content-transform-origin) overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
      >
        <ComboboxViewport class="max-h-64 overflow-auto p-1">
          <ComboboxEmpty class="py-6 text-center text-sm">没有匹配选项</ComboboxEmpty>
          <ComboboxItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
            data-slot="combobox-item"
            class="relative flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
          >
            {{ option.label }}
            <ComboboxItemIndicator><CheckIcon class="size-4" /></ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
