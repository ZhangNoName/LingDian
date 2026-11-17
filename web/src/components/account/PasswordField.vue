<script setup lang="ts">
import { ref, useId } from 'vue'
import { useAccountLocale } from '@/i18n/account'
const value = defineModel<string>({ required: true }),
  props = defineProps<{
    label: string
    autocomplete: 'current-password' | 'new-password'
    minlength: number
    disabled?: boolean
  }>(),
  visible = ref(false),
  id = useId(),
  { t } = useAccountLocale()
</script>
<template>
  <label :for="id" class="account-label">{{ label }}</label>
  <div class="flex min-w-0 gap-2">
    <input
      :id="id"
      v-model="value"
      class="account-input grow"
      :type="visible ? 'text' : 'password'"
      :autocomplete="props.autocomplete"
      :minlength="minlength"
      maxlength="256"
      required
      :disabled="disabled"
    />
    <button
      type="button"
      class="shrink-0 rounded-md border px-3 text-xs text-muted-foreground"
      :aria-pressed="visible"
      :aria-controls="id"
      :disabled="disabled"
      @click="visible = !visible"
    >
      {{ t(visible ? 'hidePassword' : 'showPassword') }}
    </button>
  </div>
</template>
<style scoped src="./account.css"></style>
