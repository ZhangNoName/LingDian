<script setup lang="ts" generic="Value extends string | number">
import { CheckIcon, ChevronDownIcon } from '@lingdian/icons/web'
import {
  ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem,
  ComboboxItemIndicator, ComboboxPortal, ComboboxRoot, ComboboxTrigger, ComboboxViewport,
} from 'reka-ui'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { IconButton } from '../button'
import { inputClasses } from '../input/styles'
import { cn } from '../utils'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  options: readonly { value: NoInfer<Value>; label: string; disabled?: boolean }[]
  disabled?: boolean
  required?: boolean
  placeholder?: string
  id?: string
}>()
const model = defineModel<Value>({ required: true })
const id = useId()
const inputId = computed(() => props.id ?? id)
const field = ref<HTMLElement>()
const open = ref(false)
const invalid = ref(false)
const inputText = ref('')
const selectedLabel = computed(() => props.options.find((option) => option.value === model.value)?.label ?? '')
const portalTo = computed(() => field.value?.closest<HTMLElement>('[role="dialog"]') ?? undefined)

watch([open, selectedLabel], ([expanded, label]) => {
  if (!expanded) inputText.value = label
}, { immediate: true })
watch(model, () => { invalid.value = false })
watch(() => props.disabled, (disabled) => { if (disabled) open.value = false })

function english() {
  return (field.value?.closest('[lang]')?.getAttribute('lang') ?? '').startsWith('en')
}

function selectCurrentText() {
  const input = field.value?.querySelector<HTMLInputElement>('input[role="combobox"]')
  if (input && input.value === selectedLabel.value) input.select()
}

function changeOpen(value: boolean) {
  open.value = value
  if (value) void nextTick(selectCurrentText)
}

function preventSearchSubmit(event: KeyboardEvent) {
  if (open.value && !event.isComposing) event.preventDefault()
}

// Keep empty options selectable without making an empty required value valid.
function itemValue(value: Value) {
  return value === '' ? null : value
}

function updateValue(value: unknown) {
  const option = props.options.find((option) => itemValue(option.value) === value)
  if (option && !option.disabled && option.value !== model.value) model.value = option.value
}

function focusInvalidInput(event: FocusEvent) {
  if (event.target instanceof HTMLInputElement && !event.target.validity.valid) {
    document.getElementById(inputId.value)?.focus()
  }
}
</script>

<template>
  <span ref="field" class="contents" @invalid.capture="invalid = true" @focusin="focusInvalidInput">
    <ComboboxRoot
      :open="open"
      as="span"
      class="contents"
      :model-value="itemValue(model)"
      :disabled="disabled"
      :required="required"
      :name="required ? id : undefined"
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      open-on-click
      @update:open="changeOpen"
      @update:model-value="updateValue"
    >
      <ComboboxAnchor as-child>
        <span
          data-slot="search-select-field"
          class="flex h-9 min-w-0 max-w-full items-center rounded-select border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
          :class="{ 'border-destructive focus-within:border-destructive focus-within:ring-destructive/20': invalid, 'opacity-50': disabled }"
        >
          <ComboboxInput
            :id="inputId"
            v-model="inputText"
            :class="cn(inputClasses, 'h-full flex-1 rounded-none border-0 pe-1 shadow-none focus-visible:ring-0 aria-invalid:ring-0 disabled:opacity-100 dark:bg-transparent')"
            :placeholder="placeholder ?? (english() ? 'Search options' : '搜索选项')"
            :aria-required="required || undefined"
            :aria-invalid="invalid || undefined"
            v-bind="$attrs"
            @focus="selectCurrentText"
            @keydown.enter="preventSearchSubmit"
          />
          <ComboboxTrigger as-child>
            <IconButton
              :icon="ChevronDownIcon"
              :label="english() ? 'Toggle options' : '展开或收起选项'"
              :disabled="disabled"
              class="me-0.5 shrink-0 text-muted-foreground"
              @pointerdown.prevent
            />
          </ComboboxTrigger>
        </span>
      </ComboboxAnchor>
      <ComboboxPortal :to="portalTo">
        <ComboboxContent
          position="popper"
          align="start"
          :side-offset="4"
          data-slot="search-select-content"
          class="z-50 max-h-(--reka-combobox-content-available-height) w-[max(12rem,var(--reka-combobox-trigger-width))] max-w-(--reka-combobox-content-available-width) overflow-hidden rounded-select border bg-popover text-popover-foreground shadow-md"
        >
          <ComboboxViewport class="max-h-60 min-h-0 overflow-y-auto p-1">
            <ComboboxEmpty class="px-2 py-3 text-center text-sm text-muted-foreground">{{ english() ? 'No matching options' : '没有匹配选项' }}</ComboboxEmpty>
            <ComboboxItem
              v-for="option in options"
              :key="JSON.stringify([option.value, option.label])"
              :value="itemValue(option.value)"
              :text-value="option.label"
              :disabled="option.disabled"
              class="flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
            >
              <span class="min-w-0 wrap-anywhere">{{ option.label }}</span>
              <ComboboxItemIndicator class="shrink-0"><CheckIcon class="size-4" /></ComboboxItemIndicator>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </span>
</template>
