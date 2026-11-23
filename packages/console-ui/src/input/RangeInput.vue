<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ min?: number; max: number; step?: number; disabled?: boolean }>(), {
  min: 0,
  step: 1,
})
const value = defineModel<number>({ required: true })
</script>

<template>
  <SliderRoot
    data-slot="slider"
    :model-value="[value]"
    :min="min"
    :max="max > min ? max : min + step"
    :step="step"
    :disabled="disabled || max <= min"
    class="relative flex h-8 w-full min-w-0 touch-none items-center select-none data-[disabled]:opacity-50"
    @update:model-value="value = $event?.[0] ?? props.min"
  >
    <SliderTrack data-slot="slider-track" class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderRange data-slot="slider-range" class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      data-slot="slider-thumb"
      v-bind="$attrs"
      :aria-disabled="disabled || max <= min || undefined"
      class="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 data-[disabled]:pointer-events-none"
    />
  </SliderRoot>
</template>
