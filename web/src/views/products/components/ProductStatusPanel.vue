<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ProductRecordContract, ProductStatus } from '@lingdian/contracts'
import { catalogStatusActions } from '../catalog-lifecycle'
import { Button } from '@lingdian/console-ui/button'
import { updateMerchantProductStatus } from '@/services/products'
import { useCatalogLocale, catalogError, type CatalogKey } from '../catalog-management-locale'
const props = defineProps<{ product: ProductRecordContract; storeId: string; disabled: boolean }>(),
  emit = defineEmits<{ busy: [boolean]; saved: [ProductRecordContract] }>(),
  { t } = useCatalogLocale(),
  target = ref<ProductStatus>(),
  saving = ref(false),
  error = ref<CatalogKey>()
const actions = computed(() => catalogStatusActions(props.product.status))
function choose(status: ProductStatus) {
  target.value = status
  error.value = undefined
}
let disposed = false
async function submit() {
  if (!target.value || saving.value || props.disabled || props.product.configuration_version === undefined) return
  saving.value = true
  emit('busy', true)
  error.value = undefined
  try {
    const result = await updateMerchantProductStatus(props.storeId, props.product.id, {
      status: target.value,
      expected_version: props.product.configuration_version,
    })
    if (disposed) return
    target.value = undefined
    emit('saved', result)
  } catch (e) {
    if (!disposed) error.value = catalogError(e)
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
onBeforeUnmount(() => {
  disposed = true
})
</script>
<template>
  <section class="grid min-w-0 gap-3 rounded-md border p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm">
        {{ t('status') }}:
        <strong>{{ t(product.status) }}</strong>
      </p>
      <div v-if="!target" class="flex flex-wrap gap-2">
        <Button
          v-for="action in actions"
          :key="action.status"
          type="button"
          size="sm"
          variant="outline"
          :disabled="disabled || saving || product.configuration_version === undefined"
          @click="choose(action.status)"
        >
          {{ t(action.label) }}
        </Button>
      </div>
    </div>
    <p class="help">{{ t('statusHint') }}</p>
    <div v-if="target" class="grid gap-3 rounded-md bg-muted/30 p-3">
      <p class="text-sm font-medium">{{ t('statusSelect') }}: {{ t(target) }}</p>
      <p class="help">{{ t(target === 'ACTIVE' ? 'publishHint' : 'unpublishHint') }}</p>
      <RouterLink v-if="target === 'ACTIVE'" class="text-sm text-primary" to="/warehouse?view=recipes">
        {{ t('recipe') }}
      </RouterLink>
      <div class="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" :disabled="saving" @click="target = undefined">
          {{ t('cancel') }}
        </Button>
        <Button type="button" :disabled="saving || disabled" @click="submit">
          {{ t(saving ? 'saving' : 'confirm') }}
        </Button>
      </div>
    </div>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
  </section>
</template>
<style scoped src="../catalog-management.css"></style>
