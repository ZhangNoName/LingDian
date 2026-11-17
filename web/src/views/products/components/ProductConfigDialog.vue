<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import ProductVariantsEditor from './ProductVariantsEditor.vue'
import ProductSelectionGroupsEditor from './ProductSelectionGroupsEditor.vue'
import {
  createProductConfigDraft,
  createProductVariant,
  createSelectionBinding,
  createSelectionOption,
  normalizeProductConfig,
  validateProductConfig,
} from '../product-config'
import type { ProductConfigForm, ProductRecord } from '../types'
import { useProductLocale } from '../use-product-locale'
import type { ProductMessageKey } from '../messages'
const props = defineProps<{
  open: boolean
  product: ProductRecord | null
  saving: boolean
  loading: boolean
  error?: ProductMessageKey
  externalSkuChoices: Array<{ value: string; label: string }>
}>()
const emit = defineEmits<{ save: [draft: ProductConfigForm]; 'update:open': [open: boolean]; retry: [] }>()
const { t } = useProductLocale()
const draft = ref<ProductConfigForm>(),
  tab = ref<'variants' | 'groups'>('variants'),
  localError = ref<ProductMessageKey>()
const defaultIndex = computed(() => draft.value?.variants.findIndex((variant) => variant.is_default) ?? -1)
watch(
  () => [props.open, props.product] as const,
  ([open, product]) => {
    if (open && product) {
      draft.value = createProductConfigDraft(product)
      tab.value = 'variants'
      localError.value = undefined
    }
  },
  { immediate: true },
)
function close(open: boolean) {
  if (!props.saving) emit('update:open', open)
}
function removeVariant(index: number) {
  if (!draft.value) return
  const id = draft.value.variants[index]?.id
  if (
    id &&
    draft.value.selection_groups.some(
      (binding) =>
        binding.target_variant_id === id || binding.group.options.some((option) => option.referenced_sku_id === id),
    )
  ) {
    localError.value = 'variantInUse'
    return
  }
  draft.value.variants.splice(index, 1)
  draft.value = normalizeProductConfig(draft.value)
  localError.value = undefined
}
function setDefault(index: number) {
  draft.value?.variants.forEach((variant, current) => {
    variant.is_default = index === current
  })
}
function submit() {
  if (!draft.value || props.saving) return
  localError.value = validateProductConfig(draft.value)
  if (!localError.value) emit('save', normalizeProductConfig(draft.value))
}
</script>
<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="max-h-[92dvh] max-w-4xl overflow-y-auto" :close-label="t('close')" :close-disabled="saving">
      <DialogHeader>
        <DialogTitle>
          {{ t('configTitle') }}
          <span class="mt-1 block break-words text-sm">{{ product?.name }}</span>
        </DialogTitle>
        <DialogDescription>{{ t('configurationHint') }}</DialogDescription>
      </DialogHeader>
      <p v-if="loading" role="status" class="p-6 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="!product || !draft" role="alert">
        <p>{{ t(error ?? 'loadFailed') }}</p>
        <Button variant="outline" @click="$emit('retry')">{{ t('refresh') }}</Button>
      </div>
      <form v-else class="grid gap-4" novalidate @submit.prevent="submit">
        <fieldset :disabled="saving" class="grid min-w-0 gap-4">
          <p class="break-words text-sm text-muted-foreground">{{ product.description || t('noDescription') }}</p>
          <label class="grid gap-1 text-xs text-muted-foreground">
            {{ t('type') }}
            <select v-model="draft.type" class="rounded-md border bg-background p-2 text-sm">
              <option value="SINGLE">{{ t('SINGLE') }}</option>
              <option value="PACKAGE">{{ t('PACKAGE') }}</option>
            </select>
          </label>
          <div class="flex gap-2 border-b pb-3">
            <Button
              type="button"
              :variant="tab === 'variants' ? 'secondary' : 'ghost'"
              :aria-pressed="tab === 'variants'"
              @click="tab = 'variants'"
            >
              {{ t('variants') }}
            </Button>
            <Button
              type="button"
              :variant="tab === 'groups' ? 'secondary' : 'ghost'"
              :aria-pressed="tab === 'groups'"
              @click="tab = 'groups'"
            >
              {{ t('groups') }}
            </Button>
          </div>
          <ProductVariantsEditor
            v-if="tab === 'variants'"
            :model-value="draft.variants"
            :current-default-index="defaultIndex"
            @add-variant="draft.variants.push(createProductVariant(false))"
            @remove-variant="removeVariant"
            @set-default="setDefault"
          />
          <ProductSelectionGroupsEditor
            v-else
            :model-value="draft.selection_groups"
            :variants="draft.variants"
            :external-sku-choices="externalSkuChoices"
            @add-group="draft.selection_groups.push(createSelectionBinding(draft.selection_groups.length))"
            @remove-group="draft.selection_groups.splice($event, 1)"
            @add-option="draft.selection_groups[$event]?.group.options.push(createSelectionOption())"
            @remove-option="(group, option) => draft?.selection_groups[group]?.group.options.splice(option, 1)"
          />
        </fieldset>
        <p v-if="localError || error" role="alert" class="text-sm text-destructive">{{ t(localError ?? error!) }}</p>
        <p v-if="product.configuration_version === undefined" role="alert" class="text-sm text-destructive">
          {{ t('missingVersion') }}
        </p>
        <div class="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" :disabled="saving" @click="close(false)">{{ t('cancel') }}</Button>
          <Button type="submit" :disabled="saving || product.configuration_version === undefined">
            {{ t(saving ? 'saving' : 'save') }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
