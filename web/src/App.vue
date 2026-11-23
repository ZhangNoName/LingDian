<template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { watchEffect } from 'vue'
import { useLocale } from '@/i18n/locale'
import { pageTitle } from '@/i18n/page-titles'
const route = useRoute(),
  { locale } = useLocale()
watchEffect(() => {
  document.documentElement.lang = locale.value
  document.title = pageTitle(route.name, locale.value, route.query) + ' · LingDian'
})
</script>
