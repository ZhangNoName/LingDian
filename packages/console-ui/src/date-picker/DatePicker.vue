<script setup lang="ts">
import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date'
import { computed, ref, useId, watchEffect } from 'vue'
import { CalendarDays } from '@lingdian/icons/web'
import { IconButton } from '../button'
import { Calendar } from '../calendar'
import { Input } from '../input'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../popover'

const props = defineProps<{
  label: string
  locale?: string
  labels?: { calendar: string; previousMonth: string; nextMonth: string; invalidDate: string; tooEarly: string; tooLate?: string }
  max?: string
  min?: string
  required?: boolean
  disabled?: boolean
}>()
const value = defineModel<string>({ required: true })
const id = useId()
const input = ref<InstanceType<typeof Input>>()
const trigger = ref<InstanceType<typeof IconButton>>()
const open = ref(false)
const returnFocus = ref(false)
const touched = ref(false)

function fromIso(text: string | undefined) {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return
  try {
    const date = parseDate(text)
    return date.toString() === text ? date : undefined
  } catch {
    return undefined
  }
}

const labels = computed(() => {
  const defaults = props.locale?.startsWith('en') ? {
    calendar: `Open calendar · ${props.label}`,
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    invalidDate: 'Enter a valid date in YYYY-MM-DD format.',
    tooEarly: `Enter a date on or after ${props.min}.`,
    tooLate: `Enter a date on or before ${props.max}.`,
  } : {
    calendar: `打开日历 · ${props.label}`,
    previousMonth: '上个月',
    nextMonth: '下个月',
    invalidDate: '请输入有效日期，格式为 YYYY-MM-DD。',
    tooEarly: `请输入 ${props.min} 或之后的日期。`,
    tooLate: `请输入 ${props.max} 或之前的日期。`,
  }
  return { ...defaults, ...props.labels }
})
const maximum = computed(() => fromIso(props.max))
const date = computed(() => fromIso(value.value))
const minimum = computed(() => fromIso(props.min))
const openingDate = computed(() => {
  const initial = date.value ?? today(getLocalTimeZone())
  if (minimum.value && initial.compare(minimum.value) < 0) return minimum.value
  if (maximum.value && initial.compare(maximum.value) > 0) return maximum.value
  return initial
})
const message = computed(() => {
  if (!value.value) return ''
  if (!date.value) return labels.value.invalidDate
  if (minimum.value && date.value.compare(minimum.value) < 0) return labels.value.tooEarly
  if (maximum.value && date.value.compare(maximum.value) > 0) return labels.value.tooLate
  return ''
})

// Keep the popup inside the enclosing dialog's focus trap when used in a form dialog.
const portalTo = computed(() => (input.value?.$el as HTMLElement | undefined)?.closest<HTMLElement>('[role="dialog"]') ?? undefined)
watchEffect(() => {
  const field = input.value?.$el as HTMLInputElement | undefined
  field?.setCustomValidity(message.value)
}, { flush: 'post' })

function selectDate(selection: DateValue | DateValue[] | undefined) {
  if (!selection || Array.isArray(selection)) return
  value.value = selection.toString()
  returnFocus.value = true
  open.value = false
}

function restoreTriggerFocus(event: Event) {
  if (!returnFocus.value) return
  returnFocus.value = false
  event.preventDefault()
  trigger.value?.$el.focus({ preventScroll: true })
}
</script>

<template>
  <div class="grid w-36 max-w-full gap-1.5 text-xs text-muted-foreground" data-slot="date-picker">
    <label :for="id">{{ label }}</label>
    <Popover v-model:open="open">
      <PopoverAnchor as-child>
        <div class="relative">
          <Input
            :id="id"
            ref="input"
            v-model="value"
            type="text"
            class="pr-9 font-normal tabular-nums text-foreground"
            placeholder="YYYY-MM-DD"
            autocomplete="off"
            :required="required"
            :disabled="disabled"
            :aria-invalid="touched && (!!message || (required && !value)) || undefined"
            @blur="touched = true"
            @invalid="touched = true"
            @keydown.alt.down.prevent="open = true"
          />
          <PopoverTrigger as-child>
            <IconButton
              ref="trigger"
              :icon="CalendarDays"
              :label="labels.calendar"
              class="absolute inset-y-1 right-1 size-7"
              :disabled="disabled"
            />
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        class="w-auto p-0"
        :portal-to="portalTo"
        :aria-label="labels.calendar"
        @escape-key-down="returnFocus = true"
        @close-auto-focus="restoreTriggerFocus"
      >
        <Calendar
          :model-value="date"
          :default-placeholder="openingDate"
          :min-value="minimum"
          :max-value="maximum"
          :locale="locale ?? 'zh-CN'"
          :calendar-label="label"
          :previous-label="labels.previousMonth"
          :next-label="labels.nextMonth"
          initial-focus
          prevent-deselect
          @update:model-value="selectDate"
        />
      </PopoverContent>
    </Popover>
  </div>
</template>
