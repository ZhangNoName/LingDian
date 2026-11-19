<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'
import { Checkbox, Input, RadioGroup, RadioGroupItem } from '@lingdian/console-ui/input'
import type { ProductVariantForm } from '../types'
import { useProductLocale } from '../use-product-locale'
defineProps<{ modelValue: ProductVariantForm[]; currentDefaultIndex: number }>()
const emit = defineEmits<{ 'add-variant': []; 'remove-variant': [index: number]; 'set-default': [index: number] }>()
const { t } = useProductLocale()

function selectDefault(value: unknown) {
  if (typeof value === 'number') emit('set-default', value)
}
</script>
<template>
  <section class="grid gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">{{ t('variants') }}</h3>
      <Button
        type="button"
        size="sm"
        variant="outline"
        :disabled="modelValue.length >= 50"
        @click="$emit('add-variant')"
      >
        {{ t('addVariant') }}
      </Button>
    </div>
    <p class="text-xs leading-5 text-muted-foreground">{{ t('stockHint') }}</p>
    <RadioGroup
      :model-value="currentDefaultIndex"
      :aria-label="t('defaultVariant')"
      @update:model-value="selectDefault"
    >
      <div
        v-for="(variant, index) in modelValue"
        :key="variant.id ?? index"
        class="grid gap-3 rounded-md border p-3 sm:grid-cols-3"
      >
        <label>
          {{ t('variantName') }} {{ index + 1 }}
          <Input v-model="variant.sku_name" maxlength="191" required />
        </label>
        <label>
          {{ t('salePrice') }} {{ index + 1 }}
          <Input v-model.number="variant.price" type="number" min="0" max="99999999.99" step="0.01" required />
        </label>
        <label>
          {{ t('referenceStock') }} {{ index + 1 }}
          <Input v-model.number="variant.stock_count" type="number" min="0" max="999999" step="1" required />
        </label>
        <div class="flex flex-wrap items-center gap-4 sm:col-span-3">
          <label class="check">
            <RadioGroupItem :value="index" :disabled="!variant.is_active" />
            {{ t('defaultVariant') }}
          </label>
          <label class="check">
            <Checkbox v-model="variant.is_active" />
            {{ t('enabled') }}
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            class="ml-auto"
            :disabled="modelValue.length <= 1"
            :aria-label="`${t('remove')} ${variant.sku_name || index + 1}`"
            @click="$emit('remove-variant', index)"
          >
            {{ t('remove') }}
          </Button>
        </div>
      </div>
    </RadioGroup>
  </section>
</template>
<style scoped>
label {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--ld-text-muted);
}
label.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
