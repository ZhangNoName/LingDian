<script setup lang="ts">
import { computed } from 'vue'
import { Button, IconButton } from '@lingdian/console-ui/button'
import { Checkbox, Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { Trash2 } from '@lingdian/icons/web'
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
    <div class="flex justify-end">
      <Button type="button" size="sm" variant="outline" :disabled="modelValue.length >= 20" @click="$emit('add-group')">
        {{ t('addGroup') }}
      </Button>
    </div>
    <p v-if="!modelValue.length" class="text-sm text-muted-foreground">
      {{ t('noGroups') }}
    </p>
    <section
      v-for="(binding, groupIndex) in modelValue"
      :key="binding.id ?? groupIndex"
      class="@container grid min-w-0 gap-3"
      :class="groupIndex > 0 && 'mt-2 border-t pt-4'"
      :aria-label="binding.group.name || `${t('groupName')} ${groupIndex + 1}`"
    >
      <div
        class="group-fields grid min-w-0 items-end gap-2.5 @min-[20rem]:grid-cols-2"
        :class="{ 'group-fields--variant': binding.scope === 'VARIANT' }"
      >
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
      </div>
      <div class="group-rules grid min-w-0 grid-cols-2 items-end gap-2.5">
        <label>
          {{ t('min') }}
          <Input v-model.number="binding.group.min_select" type="number" min="0" max="50" step="1" required />
        </label>
        <label>
          {{ t('max') }}
          <Input v-model.number="binding.group.max_select" type="number" min="0" max="50" step="1" required />
        </label>
        <label class="group-description col-span-full">
          {{ t('description') }}
          <Input v-model="binding.group.description" maxlength="191" />
        </label>
        <div class="group-actions col-span-full flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
          <label class="check whitespace-nowrap">
            <Checkbox v-model="binding.group.is_required" />
            {{ t('required') }}
          </label>
          <label class="check whitespace-nowrap">
            <Checkbox v-model="binding.group.is_active" />
            {{ t('enabled') }}
          </label>
          <label class="check whitespace-nowrap">
            <Checkbox v-model="binding.is_enabled" />
            {{ t('groupEnabled') }}
          </label>
          <IconButton
            :icon="Trash2"
            :label="`${t('removeGroup')} ${binding.group.name || groupIndex + 1}`"
            class="ms-auto"
            @click="$emit('remove-group', groupIndex)"
          />
        </div>
      </div>
      <div
        v-for="(option, optionIndex) in binding.group.options"
        :key="option.id ?? optionIndex"
        class="option-row grid min-w-0 items-end gap-2.5 bg-muted/40 px-3 py-2.5 @min-[28rem]:grid-cols-2"
        :class="{ 'option-row--reference': option.option_type === 'VARIANT' }"
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
        <div class="option-actions col-span-full flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
          <label class="check whitespace-nowrap">
            <Checkbox v-model="option.is_default" />
            {{ t('defaultOption') }}
          </label>
          <label class="check whitespace-nowrap">
            <Checkbox v-model="option.is_active" />
            {{ t('enabled') }}
          </label>
          <IconButton
            :icon="Trash2"
            :label="`${t('remove')} ${option.name || optionIndex + 1}`"
            class="ms-auto"
            :disabled="binding.group.options.length <= 1"
            @click="$emit('remove-option', groupIndex, optionIndex)"
          />
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

@container (min-width: 46rem) {
  .group-fields {
    grid-template-columns: minmax(0, 1.3fr) repeat(3, minmax(0, 1fr));
  }
  .group-fields--variant {
    grid-template-columns: minmax(0, 1.3fr) repeat(4, minmax(0, 1fr));
  }
  .group-rules {
    grid-template-columns: minmax(6.5rem, 0.8fr) minmax(6.5rem, 0.8fr) minmax(0, 2fr) auto;
  }
  .group-description {
    grid-column: auto;
  }
  .option-row {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(6.75rem, 0.6fr) auto;
  }
  .option-row--reference {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(6.75rem, 0.65fr) auto;
  }
  .group-actions,
  .option-actions {
    grid-column: auto;
    flex-wrap: nowrap;
  }
}
</style>
