<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@lingdian/console-ui/button'
import { Checkbox, Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import type { ProductSelectionBindingForm, ProductVariantForm } from '../types'
import { useProductLocale } from '../use-product-locale'
const props = defineProps<{
  modelValue: ProductSelectionBindingForm[]
  variants: ProductVariantForm[]
  externalSkuChoices: Array<{ value: string; label: string }>
}>()
defineEmits<{
  'add-group': []
  'remove-group': [index: number]
  'add-option': [group: number]
  'remove-option': [group: number, option: number]
}>()
const { t } = useProductLocale()
const referenceChoices = computed(() => [
  ...new Map(
    [
      ...props.externalSkuChoices,
      ...props.variants
        .filter((variant) => variant.id)
        .map((variant) => ({ value: variant.id!, label: `${t('currentProduct')} / ${variant.sku_name || '—'}` })),
    ].map((item) => [item.value, item]),
  ).values(),
])
</script>
<template>
  <section class="grid gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">{{ t('groups') }}</h3>
      <Button type="button" size="sm" variant="outline" :disabled="modelValue.length >= 20" @click="$emit('add-group')">
        {{ t('addGroup') }}
      </Button>
    </div>
    <p class="text-xs leading-5 text-muted-foreground">{{ t('referenceHint') }}</p>
    <p v-if="!modelValue.length" class="rounded-md border p-6 text-center text-sm text-muted-foreground">
      {{ t('noGroups') }}
    </p>
    <section
      v-for="(binding, groupIndex) in modelValue"
      :key="binding.id ?? groupIndex"
      class="grid gap-3 rounded-md border p-3"
    >
      <div class="flex items-center justify-between gap-3">
        <h4 class="min-w-0 break-words text-sm font-medium">
          {{ binding.group.name || `${t('groupName')} ${groupIndex + 1}` }}
        </h4>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          :aria-label="`${t('remove')} ${binding.group.name || groupIndex + 1}`"
          @click="$emit('remove-group', groupIndex)"
        >
          {{ t('remove') }}
        </Button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label>
          {{ t('groupName') }} {{ groupIndex + 1 }}
          <Input v-model="binding.group.name" maxlength="191" required />
        </label>
        <label>
          {{ t('scope') }}
          <SelectField
            v-model="binding.scope"
            :aria-label="t('scope')"
            :options="[
              { value: 'PRODUCT', label: t('PRODUCT') },
              { value: 'VARIANT', label: t('VARIANT') },
            ]"
          />
        </label>
        <label v-if="binding.scope === 'VARIANT'">
          {{ t('targetVariant') }}
          <SelectField
            :model-value="binding.target_variant_id ?? ''"
            :aria-label="t('targetVariant')"
            required
            @update:model-value="binding.target_variant_id = $event"
            :options="variants.filter((variant) => variant.id).map((variant) => ({ value: variant.id!, label: variant.sku_name || '—' }))"
          />
        </label>
        <label>
          {{ t('groupType') }}
          <SelectField
            v-model="binding.group.group_type"
            :aria-label="t('groupType')"
            :options="[
              { value: 'MODIFIER', label: t('MODIFIER') },
              { value: 'COMPONENT', label: t('COMPONENT') },
            ]"
          />
        </label>
        <label>
          {{ t('mode') }}
          <SelectField
            v-model="binding.group.selection_mode"
            :aria-label="t('mode')"
            :options="[
              { value: 'SINGLE', label: t('SINGLE_SELECT') },
              { value: 'MULTIPLE', label: t('MULTIPLE') },
            ]"
          />
        </label>
        <label>
          {{ t('min') }}
          <Input v-model.number="binding.group.min_select" type="number" min="0" max="50" step="1" required />
        </label>
        <label>
          {{ t('max') }}
          <Input v-model.number="binding.group.max_select" type="number" min="0" max="50" step="1" required />
        </label>
        <label class="sm:col-span-2">
          {{ t('description') }}
          <Input v-model="binding.group.description" maxlength="191" />
        </label>
      </div>
      <div class="flex flex-wrap gap-4">
        <label class="check">
          <Checkbox v-model="binding.group.is_required" />
          {{ t('required') }}
        </label>
        <label class="check">
          <Checkbox v-model="binding.group.is_active" />
          {{ t('enabled') }}
        </label>
        <label class="check">
          <Checkbox v-model="binding.is_enabled" />
          {{ t('groupEnabled') }}
        </label>
      </div>
      <div
        v-for="(option, optionIndex) in binding.group.options"
        :key="option.id ?? optionIndex"
        class="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2"
      >
        <label>
          {{ t('optionName') }} {{ optionIndex + 1 }}
          <Input v-model="option.name" maxlength="191" required />
        </label>
        <label>
          {{ t('optionType') }}
          <SelectField
            v-model="option.option_type"
            :aria-label="t('optionType')"
            :options="[
              { value: 'VALUE', label: t('VALUE') },
              { value: 'VARIANT', label: t('VARIANT') },
            ]"
          />
        </label>
        <label v-if="option.option_type === 'VARIANT'">
          {{ t('reference') }}
          <SelectField
            :model-value="option.referenced_sku_id ?? ''"
            :aria-label="t('reference')"
            required
            @update:model-value="option.referenced_sku_id = $event"
            :options="referenceChoices"
          />
        </label>
        <label>
          {{ t('surcharge') }}
          <Input v-model.number="option.price_delta" type="number" min="0" max="99999999.99" step="0.01" required />
        </label>
        <div class="flex flex-wrap items-center gap-4 sm:col-span-2">
          <label class="check">
            <Checkbox v-model="option.is_default" />
            {{ t('defaultOption') }}
          </label>
          <label class="check">
            <Checkbox v-model="option.is_active" />
            {{ t('enabled') }}
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            class="ml-auto"
            :disabled="binding.group.options.length <= 1"
            :aria-label="`${t('remove')} ${option.name || optionIndex + 1}`"
            @click="$emit('remove-option', groupIndex, optionIndex)"
          >
            {{ t('remove') }}
          </Button>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="justify-self-start"
        :disabled="binding.group.options.length >= 50"
        @click="$emit('add-option', groupIndex)"
      >
        {{ t('addOption') }}
      </Button>
    </section>
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
