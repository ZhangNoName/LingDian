<script setup lang="ts">
import { DatePicker } from '@lingdian/console-ui/date-picker'
import { useLocale } from '@/i18n/locale'

const props = defineProps<{ label: string; min?: string; max?: string; required?: boolean; disabled?: boolean }>()
const value = defineModel<string>({ required: true })
const { locale } = useLocale()
</script>

<template>
  <DatePicker v-model="value" v-bind="props" :locale="locale" />
</template>
