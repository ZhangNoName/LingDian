<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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
import { inputClasses } from '../input/styles'
import { cn } from '../utils'

const props = defineProps<{
  options: readonly { value: string; label: string; disabled?: boolean }[]
  label: string
  inputId?: string
  placeholder?: string
  triggerLabel?: string
  emptyLabel?: string
  loadingLabel?: string
  selectedLabel?: string
  remoteSearch?: boolean
  required?: boolean
  multiple?: boolean
  clearable?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ search: [string] }>()
const model = defineModel<string | string[] | null>({ required: true })
const open = ref(false)
const input = ref<InstanceType<typeof ComboboxInput>>()
const inputText = ref('')
const selected = computed(() => Array.isArray(model.value) ? model.value : [])
const popupLabel = computed(() => props.triggerLabel ?? `展开${props.label}`)
const labelFor = (value: string) => props.options.find((option) => option.value === value)?.label ?? value

function displayValue(value: unknown) {
  if (typeof value !== 'string') return ''
  if (value === model.value && props.selectedLabel !== undefined) return props.selectedLabel
  return labelFor(value)
}

watch(() => displayValue(model.value), (label) => {
  if (props.remoteSearch && !open.value) inputText.value = label
}, { immediate: true })

function changeOpen(value: boolean) {
  open.value = value
  if (!props.remoteSearch) return
  if (!value) {
    // Reka closes the list before emitting the selected value.
    void nextTick(() => { if (!open.value) emit('search', '') })
    return
  }
  void nextTick(() => {
    const field = input.value?.$el
    if (field instanceof HTMLInputElement && field.value === displayValue(model.value)) field.select()
  })
}

function search(event: Event) {
  if (!props.remoteSearch || (event instanceof InputEvent && event.isComposing)) return
  if (event.target instanceof HTMLInputElement) emit('search', event.target.value)
}

function preventSearchSubmit(event: KeyboardEvent) {
  if (props.remoteSearch && !event.isComposing) event.preventDefault()
}

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
    :ignore-filter="remoteSearch"
    open-on-click
    class="grid min-w-0 gap-1"
    @update:open="changeOpen"
    @update:model-value="updateValue"
  >
    <ComboboxAnchor as-child>
      <div class="grid min-w-0 gap-1">
        <div data-slot="input-group" class="flex min-w-0 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          <ComboboxInput
            ref="input"
            :id="inputId"
            :class="cn(inputClasses, 'min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0 dark:bg-transparent')"
            :model-value="remoteSearch ? inputText : undefined"
            :display-value="displayValue"
            :placeholder="placeholder"
            :aria-label="label"
            :aria-required="required || undefined"
            data-slot="input"
            @update:model-value="inputText = $event"
            @input="search"
            @compositionend="search"
            @keydown.enter="preventSearchSubmit"
          />
          <IconButton v-if="clearable && (multiple ? selected.length : model)" :icon="X" :disabled="disabled" label="清除" @click="clear" />
          <ComboboxTrigger as-child :aria-label="popupLabel">
            <IconButton :icon="ChevronDownIcon" :disabled="disabled" :label="popupLabel" />
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
          <p v-if="loadingLabel" role="status" class="px-2 py-3 text-sm text-muted-foreground">{{ loadingLabel }}</p>
          <ComboboxEmpty v-else class="py-6 text-center text-sm">{{ emptyLabel ?? '没有匹配选项' }}</ComboboxEmpty>
          <ComboboxItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
            :aria-disabled="option.disabled || undefined"
            data-slot="combobox-item"
            class="relative flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
          >
            <span class="min-w-0 wrap-anywhere">{{ option.label }}</span>
            <ComboboxItemIndicator class="shrink-0"><CheckIcon class="size-4" /></ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
