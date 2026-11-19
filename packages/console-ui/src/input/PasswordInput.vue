<script setup lang="ts">
import { EyeIcon, EyeOffIcon } from '@lingdian/icons/web'
import { ref, useId } from 'vue'
import { Button } from '../button'
import Input from './Input.vue'

defineOptions({ inheritAttrs: false })
defineProps<{ id?: string; disabled?: boolean; showLabel?: string; hideLabel?: string }>()
const model = defineModel<string>({ required: true })
const fallbackId = useId()
const visible = ref(false)
</script>

<template>
  <div class="relative min-w-0">
    <Input
      :id="id ?? fallbackId"
      v-model="model"
      v-bind="$attrs"
      class="block pr-11"
      :type="visible ? 'text' : 'password'"
      :disabled="disabled"
    />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="absolute inset-y-0.5 right-0.5 h-auto w-9 text-muted-foreground"
      :aria-label="visible ? (hideLabel ?? '隐藏密码') : (showLabel ?? '显示密码')"
      :aria-controls="id ?? fallbackId"
      :disabled="disabled"
      @mousedown.prevent
      @click="visible = !visible"
    >
      <EyeIcon v-if="visible" aria-hidden="true" />
      <EyeOffIcon v-else aria-hidden="true" />
    </Button>
  </div>
</template>

<style scoped>
:deep(input::-ms-reveal) { display: none; }
</style>
