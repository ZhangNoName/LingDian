<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { CategoryContract, ProductRecordContract } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { ComboboxField } from '@lingdian/console-ui/combobox'
import { Checkbox, Input } from '@lingdian/console-ui/input'
import { Textarea } from '@lingdian/console-ui/textarea'
import {
  merchantCategories,
  createMerchantCategory,
  createMerchantProduct,
} from '@/services/products'
import { useCatalogLocale, catalogError, type CatalogKey } from '../catalog-management-locale'
const props = defineProps<{ storeId: string; product?: ProductRecordContract; disabled?: boolean }>(),
  emit = defineEmits<{ saved: [ProductRecordContract]; busy: [boolean]; dirty: [boolean]; cancel: []; submit: [] }>(),
  { t } = useCatalogLocale()
const categoryInputId = useId()
const name = ref(''),
  description = ref(''),
  category = ref(''),
  featured = ref(false),
  skuName = ref(''),
  price = ref(0),
  keyword = ref(''),
  categories = ref<CategoryContract[]>([]),
  selectedCategory = ref<CategoryContract>(),
  newCategory = ref(false),
  categoryName = ref(''),
  loading = ref(false),
  categoryLookupFailed = ref(false),
  saving = ref(false),
  error = ref<CatalogKey>(),
  categoryNotice = ref(false)
const loadingCurrentCategory = computed(() => loading.value && !!category.value && !selectedCategory.value)
const dirty = computed(
  () =>
    !!props.product &&
    (name.value.trim() !== props.product.name.trim() ||
      description.value.trim() !== (props.product.description ?? '').trim() ||
      category.value !== props.product.category_id ||
      featured.value !== props.product.is_featured),
)
watch(dirty, (value) => emit('dirty', value), { immediate: true })
const options = computed(() =>
  !keyword.value && selectedCategory.value && !categories.value.some((row) => row.id === selectedCategory.value?.id)
    ? [selectedCategory.value, ...categories.value]
    : categories.value,
)

const categoryLabel = (row: CategoryContract) => row.is_visible ? row.name : `${row.name} (${t('hidden')})`
const selectedLabel = computed(() =>
  selectedCategory.value ? categoryLabel(selectedCategory.value) :
    category.value && props.product?.category_id === category.value ? props.product.category : undefined,
)

function selectCategory(value: string | string[] | null) {
  const row = options.value.find((option) => option.id === value)
  if (!row?.is_visible) return
  category.value = row.id
  selectedCategory.value = row
  if (error.value === 'categoryUnavailable' || error.value === 'invalid') error.value = undefined
}
let requestId = '',
  sequence = 0,
  disposed = false
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  [
    () => props.storeId,
    () => props.product?.id,
    () => props.product?.name,
    () => props.product?.description,
    () => props.product?.category_id,
    () => props.product?.is_featured,
  ],
  () => {
    name.value = props.product?.name ?? ''
    description.value = props.product?.description ?? ''
    category.value = props.product?.category_id ?? ''
    selectedCategory.value = undefined
    categories.value = []
    keyword.value = ''
    featured.value = props.product?.is_featured ?? false
    skuName.value = t('regular')
    price.value = 0
    error.value = undefined
    requestId = crypto.randomUUID()
    clearTimeout(searchTimer)
    void lookup(++sequence, '')
  },
  { immediate: true },
)
function searchCategories(value: string) {
  const query = value.trim().slice(0, 120)
  if (query === keyword.value && !categoryLookupFailed.value) return
  const current = ++sequence
  keyword.value = query
  categories.value = []
  loading.value = true
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void lookup(current, query), query ? 220 : 0)
}

async function lookup(current: number, query: string) {
  const storeId = props.storeId
  const categoryId = category.value
  loading.value = true
  categoryLookupFailed.value = false
  try {
    const [result, selected] = await Promise.all([
      merchantCategories(storeId, query),
      categoryId && !selectedCategory.value
        ? merchantCategories(storeId, '', categoryId)
        : null,
    ])
    if (current === sequence) {
      categories.value = result.items
      if (selected && category.value === categoryId) {
        selectedCategory.value = selected.items[0]
        if (!selectedCategory.value) {
          category.value = ''
          error.value = 'categoryUnavailable'
        }
      }
    }
  } catch {
    if (current === sequence) categoryLookupFailed.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
async function addCategory() {
  if (saving.value || props.disabled || !categoryName.value.trim()) return
  saving.value = true
  emit('busy', true)
  error.value = undefined
  try {
    const result = await createMerchantCategory(props.storeId, categoryName.value.trim())
    if (disposed) return
    categories.value = [result, ...categories.value.filter((row) => row.id !== result.id)]
    category.value = result.id
    selectedCategory.value = result
    newCategory.value = false
    categoryName.value = ''
    categoryNotice.value = true
  } catch (e) {
    if (!disposed) error.value = catalogError(e)
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
function prepareUpdate() {
  if (loadingCurrentCategory.value) return
  if (!name.value.trim() || !category.value) {
    error.value = 'invalid'
    return
  }
  return {
    category_id: category.value,
    name: name.value.trim(),
    description: description.value.trim(),
    is_featured: featured.value,
  }
}

async function submit() {
  if (saving.value || props.disabled || loadingCurrentCategory.value) return
  if (props.product) {
    emit('submit')
    return
  }
  const body = prepareUpdate()
  if (!body) return
  saving.value = true
  emit('busy', true)
  error.value = undefined
  try {
    const result = await createMerchantProduct(props.storeId, {
      ...body,
      requestId,
      sku_name: skuName.value.trim(),
      price: price.value,
    })
    if (disposed) return
    emit('saved', result)
  } catch (e) {
    if (!disposed) error.value = catalogError(e)
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
onBeforeUnmount(() => {
  emit('dirty', false)
  disposed = true
  sequence++
  clearTimeout(searchTimer)
})
defineExpose({ prepareUpdate, loading: loadingCurrentCategory })
</script>
<template>
  <form class="catalog-form" @submit.prevent="submit">
    <fieldset :disabled="saving || disabled" class="grid min-w-0 gap-4">
      <div class="grid min-w-0 gap-3" :class="$slots.type && 'sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.55fr)]'">
        <label>
          {{ t('name') }}
          <Input v-model="name" required maxlength="191" />
        </label>
        <slot name="type" />
      </div>
      <label>
        {{ t('description') }}
        <Textarea v-model="description" maxlength="2000" rows="3" />
      </label>
      <div class="grid min-w-0 gap-1.5">
        <label :for="categoryInputId">{{ t('category') }}</label>
        <ComboboxField
          :input-id="categoryInputId"
          :model-value="category || null"
          :selected-label="selectedLabel"
          :label="t('category')"
          :placeholder="t('chooseCategory')"
          :trigger-label="t('expandCategory')"
          :empty-label="t(categoryLookupFailed ? 'failed' : 'noCategories')"
          :loading-label="loading ? t('loading') : undefined"
          :disabled="saving || disabled"
          :options="options.map((row) => ({ value: row.id, label: categoryLabel(row), disabled: !row.is_visible }))"
          remote-search
          required
          @search="searchCategories"
          @update:model-value="selectCategory"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="check">
          <Checkbox v-model="featured" />
          {{ t('featured') }}
        </label>
        <Button type="button" size="sm" variant="outline" :aria-expanded="newCategory" @click="newCategory = !newCategory">
          {{ t('addCategory') }}
        </Button>
      </div>
      <div v-if="newCategory" class="flex min-w-0 items-end gap-2">
        <label class="min-w-0 grow">
          {{ t('categoryName') }}
          <Input v-model="categoryName" maxlength="120" @keydown.enter.prevent="addCategory" />
        </label>
        <Button type="button" variant="outline" :disabled="!categoryName.trim()" @click="addCategory">
          {{ t('add') }}
        </Button>
      </div>
      <p v-if="categoryNotice" role="status" class="text-sm text-emerald-700">{{ t('categoryAdded') }}</p>
      <template v-if="!product">
        <label>
          {{ t('skuName') }}
          <Input v-model="skuName" required maxlength="191" />
        </label>
        <label>
          {{ t('price') }}
          <Input v-model.number="price" type="number" min="0" max="99999999.99" step="0.01" required />
        </label>
      </template>
    </fieldset>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
    <Button v-if="product" type="submit" class="hidden" :disabled="disabled || loadingCurrentCategory">{{ t('saveChanges') }}</Button>
    <div v-if="!product" class="flex justify-end gap-2 border-t pt-4">
      <Button type="button" variant="outline" :disabled="saving || disabled" @click="$emit('cancel')">
        {{ t('cancel') }}
      </Button>
      <Button
        type="submit"
        class="justify-self-end"
        :disabled="saving || disabled || loadingCurrentCategory"
      >
        {{ t(saving ? 'saving' : 'saveDraft') }}
      </Button>
    </div>
  </form>
</template>
<style scoped src="../catalog-management.css"></style>
