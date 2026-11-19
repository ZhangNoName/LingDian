<script setup lang="ts">
import { Card } from '@lingdian/console-ui/card'
import LanguageSelect from '@/components/LanguageSelect.vue'
import { useAccountLocale } from '@/i18n/account'
defineProps<{ title: string; description: string; publicPage?: boolean }>()
const { t, locale } = useAccountLocale()
</script>
<template>
  <component
    :is="publicPage ? 'main' : 'div'"
    :class="
      publicPage ? 'flex min-h-dvh items-center justify-center bg-background px-4 py-8' : 'mx-auto w-full max-w-xl'
    "
    :lang="locale"
  >
    <Card class="w-full min-w-0 gap-0 p-5 sm:p-7" :class="publicPage ? 'max-w-md' : ''">
      <div v-if="publicPage" class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-medium text-primary">{{ t('brand') }}</p>
        <LanguageSelect />
      </div>
      <component :is="publicPage ? 'h1' : 'h2'" class="break-words text-xl font-semibold">{{ title }}</component>
      <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ description }}</p>
      <div class="mt-6"><slot /></div>
    </Card>
  </component>
</template>
