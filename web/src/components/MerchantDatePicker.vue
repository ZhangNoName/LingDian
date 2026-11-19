<script setup lang="ts">
import { computed } from 'vue'
import { DatePicker } from '@lingdian/console-ui/date-picker'
import { useLocale } from '@/i18n/locale'

const props = defineProps<{ label: string; min?: string; required?: boolean; disabled?: boolean }>()
const value = defineModel<string>({ required: true })
const { locale } = useLocale()
const labels = computed(() => locale.value === 'en-US'
  ? {
      calendar: `Open calendar · ${props.label}`,
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      invalidDate: 'Enter a valid date in YYYY-MM-DD format.',
      tooEarly: `Enter a date on or after ${props.min}.`,
    }
  : {
      calendar: `打开日历 · ${props.label}`,
      previousMonth: '上个月',
      nextMonth: '下个月',
      invalidDate: '请输入有效日期，格式为 YYYY-MM-DD。',
      tooEarly: `请输入 ${props.min} 或之后的日期。`,
    })
</script>

<template>
  <DatePicker v-model="value" v-bind="props" :locale="locale" :labels="labels" />
</template>
