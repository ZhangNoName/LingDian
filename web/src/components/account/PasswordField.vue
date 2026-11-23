<script setup lang="ts">
import { PasswordInput } from '@lingdian/console-ui/input'
import { useId } from 'vue'
import { useAccountLocale } from '@/i18n/account'
const value = defineModel<string>({ required: true }),
  props = defineProps<{
    label: string
    autocomplete: 'current-password' | 'new-password'
    minlength: number
    disabled?: boolean
  }>(),
  id = useId(),
  { t } = useAccountLocale()
</script>
<template>
  <label :for="id" class="account-label">{{ label }}</label>
  <div class="mt-2">
    <PasswordInput
      :id="id"
      v-model="value"
      class="h-10"
      :autocomplete="props.autocomplete"
      :minlength="minlength"
      :show-label="t('showPassword')"
      :hide-label="t('hidePassword')"
      maxlength="256"
      required
      :disabled="disabled"
    />
  </div>
</template>
<style scoped src="./account.css"></style>
