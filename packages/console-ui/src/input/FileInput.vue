<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { cn } from '../utils'
import { inputClasses } from './styles'

const input = useTemplateRef<HTMLInputElement>('input')
const emit = defineEmits<{ select: [files: FileList] }>()

function clear() {
  if (input.value) input.value.value = ''
}

function select() {
  if (input.value?.files?.length) emit('select', input.value.files)
}

defineExpose({ clear })
</script>

<template>
  <input
    ref="input"
    type="file"
    data-slot="file-input"
    :class="cn(inputClasses, 'block file:me-2')"
    @change="select"
  />
</template>
