<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CategoryContract, MerchantCategoryRecord } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Checkbox, Input } from '@lingdian/console-ui/input'
import { createMerchantCategory, updateMerchantCategory } from '@/services/products'
import { useCategoryLocale, categoryError, type Key } from './locale'
const props = defineProps<{ storeId: string; category?: MerchantCategoryRecord }>(),
  emit = defineEmits<{ saved: [CategoryContract]; cancel: []; busy: [boolean]; dirty: [boolean] }>(),
  { t, number } = useCategoryLocale()
const name = ref(props.category?.name ?? ''),
  sort = ref(props.category?.sort_order ?? 0),
  visible = ref(props.category?.is_visible ?? true),
  saving = ref(false),
  confirming = ref(false),
  error = ref<Key>()
const dirty = computed(
  () =>
    name.value.trim() !== (props.category?.name ?? '').trim() ||
    sort.value !== (props.category?.sort_order ?? 0) ||
    visible.value !== (props.category?.is_visible ?? true),
)
watch(dirty, (value) => emit('dirty', value), { immediate: true })
let disposed = false
function submit() {
  if (saving.value) return
  if (props.category && props.category.is_visible !== visible.value) {
    confirming.value = true
    error.value = undefined
  } else void save()
}
async function save() {
  if (saving.value) return
  if (props.category && props.category.configuration_version === undefined) {
    error.value = 'versionRequired'
    return
  }
  saving.value = true
  emit('busy', true)
  error.value = undefined
  try {
    let result: CategoryContract
    if (props.category)
      result = await updateMerchantCategory(props.storeId, props.category.id, {
        expected_version: props.category.configuration_version,
        name: name.value.trim(),
        sort_order: Number(sort.value),
        is_visible: visible.value,
      })
    else result = await createMerchantCategory(props.storeId, name.value.trim())
    if (!disposed) emit('saved', result)
  } catch (e) {
    if (!disposed) error.value = categoryError(e)
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
onBeforeUnmount(() => {
  disposed = true
  emit('dirty', false)
})
</script>
<template>
  <form class="catalog-form" @submit.prevent="submit">
    <fieldset class="grid min-w-0 gap-4" :disabled="saving || confirming">
      <label>{{ t('name') }}<Input v-model="name" required maxlength="120" /></label
      ><template v-if="category"
        ><label
          >{{ t('sort') }}<Input v-model.number="sort" type="number" min="0" max="1000000" step="1" required
        /></label>
        <p class="help">{{ t('sortHint') }}</p>
        <label class="check"><Checkbox v-model="visible" />{{ t('visible') }}</label>
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="help">{{ t('products') }}</dt>
            <dd>{{ number(category.product_count) }}</dd>
          </div>
          <div>
            <dt class="help">{{ t('active') }}</dt>
            <dd>{{ number(category.active_product_count) }}</dd>
          </div>
        </dl></template
      >
      <p v-else class="help">{{ t('createHint') }}</p>
    </fieldset>
    <div v-if="confirming" class="grid gap-3 rounded-md border p-3">
      <p class="text-sm">{{ t(visible ? 'showHint' : 'hideHint') }}</p>
      <p class="help">{{ t('impact') }}: {{ number(category?.active_product_count) }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" :disabled="saving" @click="confirming = false">{{ t('cancel') }}</Button
        ><Button type="button" :disabled="saving" @click="save">{{ t(saving ? 'saving' : 'confirm') }}</Button>
      </div>
    </div>
    <p v-if="category && category.configuration_version === undefined" role="alert" class="text-sm text-destructive">{{ t('versionRequired') }}</p>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
    <div v-if="!confirming" class="flex justify-end gap-2 border-t pt-4">
      <Button type="button" variant="outline" :disabled="saving" @click="$emit('cancel')">{{ t('back') }}</Button
      ><Button :disabled="saving || (!dirty && !!category) || (!!category && category.configuration_version === undefined)">{{
        t(saving ? 'saving' : category ? 'save' : 'create')
      }}</Button>
    </div>
  </form>
</template>
<style scoped src="../catalog-management.css"></style>
