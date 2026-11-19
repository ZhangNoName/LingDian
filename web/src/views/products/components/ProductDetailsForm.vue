<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CategoryContract, ProductRecordContract } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Checkbox, Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { Textarea } from '@lingdian/console-ui/textarea'
import {
  merchantCategories,
  createMerchantCategory,
  createMerchantProduct,
  updateMerchantProductDetails,
} from '@/services/products'
import { useCatalogLocale, catalogError, type CatalogKey } from '../catalog-management-locale'
const props = defineProps<{ storeId: string; product?: ProductRecordContract; disabled?: boolean }>(),
  emit = defineEmits<{ saved: [ProductRecordContract]; busy: [boolean]; dirty: [boolean]; cancel: [] }>(),
  { t } = useCatalogLocale()
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
  saving = ref(false),
  error = ref<CatalogKey>(),
  categoryNotice = ref(false)
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
  selectedCategory.value && !categories.value.some((row) => row.id === selectedCategory.value?.id)
    ? [selectedCategory.value, ...categories.value]
    : categories.value,
)
function selectCategory(id: string) {
  category.value = id
  selectedCategory.value = categories.value.find((row) => row.id === id) ?? selectedCategory.value
}
let requestId = '',
  sequence = 0,
  disposed = false
watch(
  () => [props.product, props.storeId],
  () => {
    name.value = props.product?.name ?? ''
    description.value = props.product?.description ?? ''
    category.value = props.product?.category_id ?? ''
    selectedCategory.value = undefined
    featured.value = props.product?.is_featured ?? false
    skuName.value = t('regular')
    price.value = 0
    error.value = undefined
    requestId = crypto.randomUUID()
    void lookup()
  },
  { immediate: true },
)
async function lookup() {
  const current = ++sequence
  loading.value = true
  error.value = undefined
  try {
    const [result, selected] = await Promise.all([
      merchantCategories(props.storeId, keyword.value.trim()),
      props.product && !selectedCategory.value
        ? merchantCategories(props.storeId, '', props.product.category_id)
        : null,
    ])
    if (current === sequence) {
      categories.value = result.items
      if (selected) {
        selectedCategory.value = selected.items[0]
        if (!selectedCategory.value) {
          category.value = ''
          error.value = 'categoryUnavailable'
        }
      }
    }
  } catch {
    if (current === sequence) error.value = 'failed'
  } finally {
    if (current === sequence) loading.value = false
  }
}
async function addCategory() {
  if (saving.value || !categoryName.value.trim()) return
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
async function submit() {
  if (saving.value || props.disabled || loading.value) return
  if (!name.value.trim() || !category.value) {
    error.value = 'invalid'
    return
  }
  saving.value = true
  emit('busy', true)
  error.value = undefined
  try {
    const body = {
      category_id: category.value,
      name: name.value.trim(),
      description: description.value.trim(),
      is_featured: featured.value,
    }
    const result = props.product
      ? await updateMerchantProductDetails(props.storeId, props.product.id, {
          ...body,
          expected_version: props.product.configuration_version!,
        })
      : await createMerchantProduct(props.storeId, {
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
})
</script>
<template>
  <form class="catalog-form" @submit.prevent="submit">
    <fieldset :disabled="saving || disabled" class="grid min-w-0 gap-4">
      <p v-if="!product" class="help">{{ t('createHint') }}</p>
      <label>
        {{ t('name') }}
        <Input v-model="name" required maxlength="191" />
      </label>
      <label>
        {{ t('description') }}
        <Textarea v-model="description" maxlength="2000" rows="3" />
      </label>
      <div class="flex items-end gap-2">
        <label class="grow">
          {{ t('findCategory') }}
          <Input v-model="keyword" type="search" maxlength="120" @keydown.enter.prevent="lookup" />
        </label>
        <Button type="button" variant="outline" :disabled="loading" @click="lookup">{{ t('find') }}</Button>
      </div>
      <label>
        {{ t('category') }}
        <SelectField
          :model-value="category"
          @update:model-value="selectCategory"
          :aria-label="t('category')"
          required
          :options="[
            { value: '', label: t('choose') },
            ...options.map((row) => ({ value: row.id, label: `${row.name}${row.is_visible ? '' : ` (${t('hidden')})`}`, disabled: !row.is_visible })),
          ]"
        />
      </label>
      <Button type="button" class="justify-self-start" variant="outline" @click="newCategory = !newCategory">
        {{ t('addCategory') }}
      </Button>
      <div v-if="newCategory" class="flex items-end gap-2 border p-3">
        <label class="grow">
          {{ t('categoryName') }}
          <Input v-model="categoryName" maxlength="120" @keydown.enter.prevent="addCategory" />
        </label>
        <Button type="button" variant="outline" :disabled="!categoryName.trim()" @click="addCategory">
          {{ t('add') }}
        </Button>
      </div>
      <p v-if="categoryNotice" role="status" class="text-sm text-emerald-700">{{ t('categoryAdded') }}</p>
      <p v-if="loading" role="status" class="help">{{ t('loading') }}</p>
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
      <label class="check">
        <Checkbox v-model="featured" />
        {{ t('featured') }}
      </label>
    </fieldset>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
    <p v-if="product && product.configuration_version === undefined" role="alert" class="text-sm text-destructive">
      {{ t('versionRequired') }}
    </p>
    <div class="flex justify-end gap-2 border-t pt-4">
      <Button type="button" variant="outline" :disabled="saving || disabled" @click="$emit('cancel')">
        {{ t('cancel') }}
      </Button>
      <Button
        type="submit"
        class="justify-self-end"
        :disabled="saving || disabled || loading || (product && product.configuration_version === undefined)"
      >
        {{ t(saving ? 'saving' : product ? 'save' : 'saveDraft') }}
      </Button>
    </div>
  </form>
</template>
<style scoped src="../catalog-management.css"></style>
