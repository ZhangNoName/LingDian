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
  locale: string
  labels: { calendar: string; previousMonth: string; nextMonth: string; invalidDate: string; tooEarly: string }
  min?: string
  required?: boolean
  disabled?: boolean
}>()
const value = defineModel<string>({ required: true })
const id = useId()
const input = ref<InstanceType<typeof Input>>()
const open = ref(false)
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

const date = computed(() => fromIso(value.value))
const minimum = computed(() => fromIso(props.min))
const openingDate = computed(() => {
  const initial = date.value ?? today(getLocalTimeZone())
  return minimum.value && initial.compare(minimum.value) < 0 ? minimum.value : initial
})
const message = computed(() => {
  if (!value.value) return ''
  if (!date.value) return props.labels.invalidDate
  if (minimum.value && date.value.compare(minimum.value) < 0) return props.labels.tooEarly
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
  open.value = false
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
              :icon="CalendarDays"
              :label="labels.calendar"
              class="absolute inset-y-1 right-1 size-7"
              :disabled="disabled"
            />
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" class="w-auto p-0" :portal-to="portalTo" :aria-label="labels.calendar">
        <Calendar
          :model-value="date"
          :default-placeholder="openingDate"
          :min-value="minimum"
          :locale="locale"
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
