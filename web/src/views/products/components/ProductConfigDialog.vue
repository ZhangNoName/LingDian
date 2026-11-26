<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@lingdian/console-ui/button'
import { Disclosure } from '@lingdian/console-ui/collapsible'
import { SearchSelectField } from '@lingdian/console-ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { saveMerchantProductConfig, updateMerchantProductDetails } from '@/services/products'
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
import { catalogError, useCatalogLocale } from '../catalog-management-locale'
import { imageError, useImageLocale } from '../image-locale'

const props = defineProps<{
  open: boolean
  storeId: string
  product: ProductRecord | null
  loading: boolean
  externalSkuChoices: Array<{ value: string; label: string }>
}>()
const emit = defineEmits<{ 'update:open': [boolean]; 'close-auto-focus': [Event]; retry: []; updated: [ProductRecord, boolean] }>()
const { t } = useProductLocale()
const { t: ct } = useCatalogLocale()
const { t: it } = useImageLocale()

const draft = ref<ProductConfigForm>()
const detailsEditor = ref<InstanceType<typeof ProductDetailsForm>>()
const imageEditor = ref<InstanceType<typeof ProductImageEditor>>()
const detailsTitle = ref<HTMLElement>()
const variantsSection = ref<HTMLElement>()
const groupsSection = ref<HTMLElement>()
const variantsOpen = ref(false)
const groupsOpen = ref(false)
const keepEditing = ref<InstanceType<typeof Button>>()
const cancelButton = ref<InstanceType<typeof Button>>()
const detailsDirty = ref(false)
const imageDirty = ref(false)
const detailsBusy = ref(false)
const statusBusy = ref(false)
const saving = ref(false)
const closePending = ref(false)
const saveError = ref('')
const saved = ref(false)
const needsReopen = ref(false)
let disposed = false
onBeforeUnmount(() => { disposed = true })

const busy = computed(() => saving.value || detailsBusy.value || statusBusy.value)
const configDirty = computed(() => !!draft.value && !!props.product && !configMatches(draft.value, props.product))
const dirty = computed(() => configDirty.value || detailsDirty.value || imageDirty.value)
const defaultIndex = computed(() => draft.value?.variants.findIndex(variant => variant.is_default) ?? -1)

function configMatches(form: ProductConfigForm, record: ProductRecord) {
  const original = createProductConfigDraft(record)
  return JSON.stringify(normalizeProductConfig({ ...form, expected_version: original.expected_version })) ===
    JSON.stringify(normalizeProductConfig(original))
}

watch(() => props.product, (record, previous) => {
  if (record?.id !== previous?.id) {
    variantsOpen.value = false
    groupsOpen.value = false
  }
  if (!record) {
    draft.value = undefined
    detailsDirty.value = false
    imageDirty.value = false
    saveError.value = ''
    saved.value = false
    closePending.value = false
    needsReopen.value = false
  } else if (!previous || previous.id !== record.id || !draft.value || configMatches(draft.value, previous)) {
    draft.value = createProductConfigDraft(record)
  }
}, { immediate: true })

async function close(open: boolean) {
  if (busy.value) return
  if (!open && dirty.value) {
    closePending.value = true
    await nextTick()
    keepEditing.value?.$el.focus()
    return
  }
  emit('update:open', open)
}

async function resumeEditing() {
  closePending.value = false
  await nextTick()
  cancelButton.value?.$el.focus()
}

function discardAndClose() {
  closePending.value = false
  emit('update:open', false)
}

function removeVariant(index: number) {
  if (!draft.value) return
  const id = draft.value.variants[index]?.id
  if (
    id &&
    draft.value.selection_groups.some(
      binding => binding.target_variant_id === id || binding.group.options.some(option => option.referenced_sku_id === id),
    )
  ) {
    saveError.value = t('variantInUse')
    return
  }
  draft.value.variants.splice(index, 1)
  draft.value = normalizeProductConfig(draft.value)
  saveError.value = ''
}

function setDefault(index: number) {
  draft.value?.variants.forEach((variant, current) => {
    variant.is_default = index === current
  })
}

function configSaveMessage(error: string) {
  if (error === 'catalog.versionRequired') return t('versionRequired')
  if (error === 'catalog.variantUnavailable') return t('unavailable')
  return t('saveFailed')
}

async function save() {
  const product = props.product
  if (!product || product.configuration_version === undefined || !dirty.value || busy.value || needsReopen.value) return

  const details = detailsDirty.value ? detailsEditor.value?.prepareUpdate() : undefined
  if (detailsDirty.value && !details) {
    detailsTitle.value?.focus()
    return
  }
  const config = configDirty.value && draft.value ? normalizeProductConfig(draft.value) : undefined
  if (config) {
    const validationError = validateProductConfig(config)
    if (validationError) {
      saveError.value = t(validationError)
      const inVariants = !!validateProductConfig({ ...config, selection_groups: [] })
      if (inVariants) variantsOpen.value = true
      else groupsOpen.value = true
      await nextTick()
      const section = inVariants ? variantsSection.value : groupsSection.value
      section?.querySelector('button')?.focus()
      return
    }
  }
  const image = imageDirty.value ? imageEditor.value : undefined

  let current = product
  let stage: 'image' | 'details' | 'config' = 'image'
  const storeId = props.storeId
  const stillEditingProduct = () => !disposed && props.storeId === storeId && props.product?.id === product.id
  const version = () => current.configuration_version!
  function accept(record: ProductRecord) {
    // A late retry may return a newer record that includes somebody else's edits.
    if (record.configuration_version !== version() + 1) throw new Error('catalog.stale')
    current = record
  }

  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    // An image retry must reuse its original request ID and version before other writes advance the version.
    if (image) accept(await image.save(version()))
    if (!stillEditingProduct()) return
    if (details) {
      stage = 'details'
      accept(await updateMerchantProductDetails(storeId, product.id, { ...details, expected_version: version() }))
    }
    if (!stillEditingProduct()) return
    if (config) {
      stage = 'config'
      accept(await saveMerchantProductConfig(product.id, { ...config, expected_version: version() }))
      draft.value = createProductConfigDraft(current)
    }
    saved.value = true
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    needsReopen.value = code === 'catalog.stale'
    const message = needsReopen.value
      ? t('stale')
      : stage === 'image'
        ? it(imageError(error))
        : stage === 'details'
          ? ct(catalogError(error))
          : configSaveMessage(code)
    saveError.value = current !== product ? ct('partialSave') + message : message
  } finally {
    if (current !== product && stillEditingProduct()) emit('updated', current, saved.value)
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent
      class="h-[min(46rem,92dvh)] w-[min(96vw,58rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-card p-0"
      :close-label="t('close')"
      :close-disabled="busy"
      :aria-describedby="undefined"
      @close-auto-focus="$emit('close-auto-focus', $event)"
    >
      <DialogHeader class="grid! min-w-0 grid-cols-[minmax(0,auto)_auto] items-center justify-start gap-3 border-b py-4 pe-14 ps-4 text-start sm:ps-6">
        <DialogTitle class="line-clamp-2 min-w-0 [overflow-wrap:anywhere]" :title="product?.name">
          {{ product?.name ?? ct('manage') }}
        </DialogTitle>
        <ProductStatusPanel
          v-if="product"
          :product="product"
          :store-id="storeId"
          :disabled="busy || needsReopen"
          :dirty="dirty"
          @busy="statusBusy = $event"
          @saved="$emit('updated', $event, true)"
        />
      </DialogHeader>
      <div class="min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        <p v-if="loading" role="status" class="py-6 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
        <div v-else-if="!product || !draft" role="alert" class="grid justify-items-center gap-3 py-6 text-sm">
          <p>{{ t('loadFailed') }}</p>
          <DataActionButton action="refresh" :label="t('refresh')" @click="$emit('retry')" />
        </div>

        <div v-else class="grid min-w-0 gap-4">
          <div class="grid min-w-0 items-start gap-6 md:grid-cols-[minmax(14rem,0.58fr)_minmax(0,1fr)]">
            <ProductImageEditor
              ref="imageEditor"
              :store-id="storeId"
              :product="product"
              :disabled="busy"
              @dirty="imageDirty = $event"
            />
            <section class="grid min-w-0 gap-3">
              <h3 ref="detailsTitle" tabindex="-1" class="text-sm font-semibold">{{ ct('details') }}</h3>
              <ProductDetailsForm
                ref="detailsEditor"
                :store-id="storeId"
                :product="product"
                :disabled="busy"
                @dirty="detailsDirty = $event"
                @busy="detailsBusy = $event"
                @submit="save"
              >
                <template #type>
                  <label class="grid gap-1.5 text-xs text-muted-foreground">
                    {{ t('type') }}
                    <SearchSelectField
                      v-model="draft.type"
                      :aria-label="t('type')"
                      :disabled="busy"
                      :options="[
                        { value: 'SINGLE', label: t('SINGLE') },
                        { value: 'PACKAGE', label: t('PACKAGE') },
                      ]"
                    />
                  </label>
                </template>
              </ProductDetailsForm>
            </section>
          </div>

          <fieldset :disabled="busy" class="grid min-w-0 divide-y border-t">
            <section ref="variantsSection" class="py-2">
              <Disclosure v-model:open="variantsOpen" trigger-class="min-h-10 px-2 hover:bg-accent hover:text-accent-foreground">
                <template #label>
                  <span class="font-semibold">{{ t('variants') }}</span>
                  <span class="ms-2 text-xs tabular-nums text-muted-foreground">{{ draft.variants.length }}</span>
                </template>
                <ProductVariantsEditor
                  class="pb-2 pt-1"
                  :model-value="draft.variants"
                  :current-default-index="defaultIndex"
                  @add-variant="draft.variants.push(createProductVariant(false))"
                  @remove-variant="removeVariant"
                  @set-default="setDefault"
                />
              </Disclosure>
            </section>
            <section ref="groupsSection" class="py-2">
              <Disclosure v-model:open="groupsOpen" trigger-class="min-h-10 px-2 hover:bg-accent hover:text-accent-foreground">
                <template #label>
                  <span class="font-semibold">{{ t('groups') }}</span>
                  <span class="ms-2 text-xs tabular-nums text-muted-foreground">{{ draft.selection_groups.length }}</span>
                </template>
                <ProductSelectionGroupsEditor
                  class="pb-2 pt-1"
                  :model-value="draft.selection_groups"
                  :variants="draft.variants"
                  :external-sku-choices="externalSkuChoices"
                  @add-group="draft.selection_groups.push(createSelectionBinding(draft.selection_groups.length))"
                  @remove-group="draft.selection_groups.splice($event, 1)"
                  @add-option="draft.selection_groups[$event]?.group.options.push(createSelectionOption())"
                  @remove-option="(group, option) => draft?.selection_groups[group]?.group.options.splice(option, 1)"
                />
              </Disclosure>
            </section>
          </fieldset>
        </div>
      </div>

      <DialogFooter class="grid! gap-2 border-t px-4 py-3 sm:px-6">
        <template v-if="closePending">
          <p role="alert" class="text-sm">{{ ct('unsavedClose') }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <Button ref="keepEditing" type="button" variant="outline" @click="resumeEditing">{{ ct('keepEditing') }}</Button>
            <Button type="button" variant="outline" @click="discardAndClose">{{ ct('discardClose') }}</Button>
          </div>
        </template>
        <div v-else class="flex flex-wrap items-center justify-end gap-2">
          <p v-if="saveError" role="alert" class="me-auto text-sm text-destructive">{{ saveError }}</p>
          <p v-else-if="product && product.configuration_version === undefined" role="alert" class="me-auto text-sm text-destructive">
            {{ t('missingVersion') }}
          </p>
          <p v-else-if="saved && !dirty" role="status" class="me-auto text-sm text-status-success-ink">{{ ct('saved') }}</p>
          <Button ref="cancelButton" type="button" variant="outline" :disabled="busy" @click="close(false)">
            {{ t(product ? 'cancel' : 'close') }}
          </Button>
          <Button
            v-if="product"
            type="button"
            :disabled="busy || !dirty || needsReopen || product.configuration_version === undefined || (detailsDirty && detailsEditor?.loading)"
            @click="save"
          >{{ saving ? t('saving') : ct('saveChanges') }}</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
