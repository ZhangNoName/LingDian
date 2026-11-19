<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@lingdian/console-ui/button'
import { SelectField } from '@lingdian/console-ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import ProductVariantsEditor from './ProductVariantsEditor.vue'
import ProductSelectionGroupsEditor from './ProductSelectionGroupsEditor.vue'
import ProductDetailsForm from './ProductDetailsForm.vue'
import ProductImageEditor from './ProductImageEditor.vue'
import ProductStatusPanel from './ProductStatusPanel.vue'
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
import { useCatalogLocale } from '../catalog-management-locale'
import type { ProductMessageKey } from '../messages'
const props = defineProps<{
    open: boolean
    storeId: string
    product: ProductRecord | null
    saving: boolean
    loading: boolean
    error?: ProductMessageKey
    externalSkuChoices: Array<{ value: string; label: string }>
  }>(),
  emit = defineEmits<{ save: [ProductConfigForm]; 'update:open': [boolean]; retry: []; updated: [ProductRecord] }>(),
  { t } = useProductLocale(),
  { t: ct } = useCatalogLocale()
const draft = ref<ProductConfigForm>(),
  editingProductId = ref(''),
  tab = ref<'details' | 'variants' | 'groups' | 'image'>('variants'),
  localError = ref<ProductMessageKey>(),
  statusBusy = ref(false),
  detailsBusy = ref(false),
  detailsDirty = ref(false),
  imageBusy = ref(false),
  imageDirty = ref(false),
  closePending = ref(false),
  editRevision = ref(0),
  busy = computed(() => props.saving || statusBusy.value || detailsBusy.value || imageBusy.value),
  defaultIndex = computed(() => draft.value?.variants.findIndex((variant) => variant.is_default) ?? -1)
const configDirty = computed(
  () =>
    !!draft.value &&
    !!props.product &&
    JSON.stringify(normalizeProductConfig(draft.value)) !==
      JSON.stringify(normalizeProductConfig(createProductConfigDraft(props.product))),
)
function discard() {
  if (props.product) draft.value = createProductConfigDraft(props.product)
  detailsDirty.value = false
  imageDirty.value = false
  editRevision.value++
}
watch(
  () => [props.open, props.product] as const,
  ([open, product]) => {
    if (!open) {
      editingProductId.value = ''
      closePending.value = false
      return
    }
    if (open && product) {
      draft.value = createProductConfigDraft(product)
      if (editingProductId.value !== product.id) tab.value = 'variants'
      editingProductId.value = product.id
      localError.value = undefined
      closePending.value = false
    }
  },
  { immediate: true },
)
function close(open: boolean) {
  if (busy.value) return
  if (!open && (configDirty.value || detailsDirty.value || imageDirty.value)) closePending.value = true
  else emit('update:open', open)
}
function discardAndClose() {
  discard()
  closePending.value = false
  emit('update:open', false)
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
  if (!draft.value || busy.value) return
  localError.value = validateProductConfig(draft.value)
  if (!localError.value) emit('save', normalizeProductConfig(draft.value))
}
</script>
<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="max-h-[92dvh] max-w-4xl overflow-y-auto" :close-label="t('close')" :close-disabled="busy">
      <DialogHeader>
        <DialogTitle>
          {{ ct('manage') }}
          <span class="mt-1 block break-words text-sm">{{ product?.name }}</span>
        </DialogTitle>
        <DialogDescription>{{ tab === 'image' ? ct('imageDescription') : t('configurationHint') }}</DialogDescription>
      </DialogHeader>
      <p v-if="loading" role="status" class="p-6 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="!product || !draft" role="alert">
        <p>{{ t(error ?? 'loadFailed') }}</p>
        <Button variant="outline" @click="$emit('retry')">{{ t('refresh') }}</Button>
      </div>
      <div v-else class="grid min-w-0 gap-4">
        <ProductStatusPanel
          :product="product"
          :store-id="storeId"
          :disabled="props.saving || detailsBusy || imageBusy || configDirty || detailsDirty || imageDirty"
          @busy="statusBusy = $event"
          @saved="$emit('updated', $event)"
        />
        <p v-if="configDirty || detailsDirty || imageDirty" role="status" class="text-sm text-amber-800">
          {{ ct('unsaved') }}
          <Button type="button" size="sm" variant="outline" :disabled="busy" @click="discard">
            {{ ct('discard') }}
          </Button>
        </p>
        <div class="flex flex-wrap gap-2 border-b pb-3">
          <Button
            type="button"
            :disabled="busy || configDirty || imageDirty"
            :variant="tab === 'details' ? 'secondary' : 'ghost'"
            :aria-pressed="tab === 'details'"
            @click="tab = 'details'"
          >
            {{ ct('details') }}
          </Button>
          <Button
            type="button"
            :disabled="busy || detailsDirty || imageDirty"
            :variant="tab === 'variants' ? 'secondary' : 'ghost'"
            :aria-pressed="tab === 'variants'"
            @click="tab = 'variants'"
          >
            {{ t('variants') }}
          </Button>
          <Button
            type="button"
            :disabled="busy || detailsDirty || imageDirty"
            :variant="tab === 'groups' ? 'secondary' : 'ghost'"
            :aria-pressed="tab === 'groups'"
            @click="tab = 'groups'"
          >
            {{ t('groups') }}
          </Button>
          <Button
            type="button"
            :disabled="busy || configDirty || detailsDirty"
            :variant="tab === 'image' ? 'secondary' : 'ghost'"
            :aria-pressed="tab === 'image'"
            @click="tab = 'image'"
            >{{ ct('image') }}</Button
          >
        </div>
        <ProductImageEditor
          v-if="tab === 'image'"
          :key="'image-' + editRevision"
          :store-id="storeId"
          :product="product"
          :disabled="props.saving || statusBusy || detailsBusy"
          @busy="imageBusy = $event"
          @dirty="imageDirty = $event"
          @saved="$emit('updated', $event)"
          @reload="$emit('retry')"
        />
        <ProductDetailsForm
          :key="editRevision"
          @dirty="detailsDirty = $event"
          @cancel="close(false)"
          v-else-if="tab === 'details'"
          :store-id="storeId"
          :product="product"
          :disabled="props.saving || statusBusy"
          @busy="detailsBusy = $event"
          @saved="$emit('updated', $event)"
        />
        <form v-else class="grid min-w-0 gap-4" novalidate @submit.prevent="submit">
          <fieldset :disabled="busy" class="grid min-w-0 gap-4">
            <label class="grid gap-1 text-xs text-muted-foreground">
              {{ t('type') }}
              <SelectField
                v-model="draft.type"
                :aria-label="t('type')"
                :options="[
                  { value: 'SINGLE', label: t('SINGLE') },
                  { value: 'PACKAGE', label: t('PACKAGE') },
                ]"
              />
            </label>
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
            <Button type="button" variant="outline" :disabled="busy" @click="close(false)">{{ t('cancel') }}</Button>
            <Button type="submit" :disabled="busy || product.configuration_version === undefined">
              {{ t(saving ? 'saving' : 'save') }}
            </Button>
          </div>
        </form>
      </div>
      <div v-if="closePending" role="alert" class="grid gap-3 rounded-md border p-3">
        <p class="text-sm">{{ ct('unsavedClose') }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" @click="closePending = false">{{ ct('keepEditing') }}</Button
          ><Button variant="outline" @click="discardAndClose">{{ ct('discardClose') }}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
