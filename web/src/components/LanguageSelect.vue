<script setup lang="ts">
import { computed } from 'vue'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@lingdian/console-ui/select'
import { useLocale } from '@/i18n/locale'

const { locale } = useLocale()
const label = computed(() => locale.value === 'en-US' ? 'Language' : '语言')

function updateLocale(value: unknown) {
  if (value === 'zh-CN' || value === 'en-US') locale.value = value
}
</script>
<template>
  <Select :model-value="locale" @update:model-value="updateLocale">
    <SelectTrigger class="w-[180px] max-w-full" :aria-label="label">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>{{ label }}</SelectLabel>
        <SelectItem value="zh-CN" lang="zh-CN">简体中文</SelectItem>
        <SelectItem value="en-US" lang="en-US">English</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>
