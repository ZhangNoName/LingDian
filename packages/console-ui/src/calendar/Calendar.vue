<script setup lang="ts">
import type { CalendarRootEmits, CalendarRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { CalendarRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '../utils'
import {
  CalendarCell, CalendarCellTrigger, CalendarGrid, CalendarGridBody, CalendarGridHead,
  CalendarGridRow, CalendarHeadCell, CalendarHeader, CalendarHeading,
  CalendarNextButton, CalendarPrevButton,
} from '.'

const props = defineProps<CalendarRootProps & {
  class?: HTMLAttributes['class']
  previousLabel?: string
  nextLabel?: string
}>()
const emit = defineEmits<CalendarRootEmits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class', 'previousLabel', 'nextLabel'), emit)
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    v-bind="forwarded"
    data-slot="calendar"
    :class="cn('p-3', props.class)"
  >
    <CalendarHeader class="pt-0">
      <CalendarHeading />

      <nav class="pointer-events-none flex items-center gap-1 absolute top-0 inset-x-0 justify-between">
        <CalendarPrevButton :aria-label="previousLabel">
          <slot name="calendar-prev-icon" />
        </CalendarPrevButton>
        <CalendarNextButton :aria-label="nextLabel">
          <slot name="calendar-next-icon" />
        </CalendarNextButton>
      </nav>
    </CalendarHeader>

    <div class="flex flex-col gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <CalendarGrid v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell
              v-for="day in weekDays" :key="day"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-2 w-full">
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="month.value"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
