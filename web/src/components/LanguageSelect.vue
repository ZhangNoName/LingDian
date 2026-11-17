<script setup lang="ts">
import { useId } from 'vue'
import { useLocale } from '@/i18n/locale'
const { locale } = useLocale(),
  id = useId()
</script>
<template>
  <label :for="id" class="sr-only">{{ locale === 'en-US' ? 'Language' : '语言' }}</label>
  <select :id="id" v-model="locale" class="max-w-full rounded-md border bg-card px-2 py-1.5 text-sm text-foreground">
    <option value="zh-CN">简体中文</option>
    <option value="en-US">English</option>
  </select>
</template>
