<script setup lang="ts">
import { ref } from 'vue'
import type { ProductRecordContract } from '@lingdian/contracts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import ProductDetailsForm from './ProductDetailsForm.vue'
import { useCatalogLocale } from '../catalog-management-locale'
defineProps<{ open: boolean; storeId: string }>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [ProductRecordContract] }>(),
  busy = ref(false),
  { t } = useCatalogLocale()
function close(open: boolean) {
  if (!busy.value) emit('update:open', open)
}
</script>
<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="max-h-[92dvh] max-w-2xl overflow-y-auto" :close-label="t('close')" :close-disabled="busy">
      <DialogHeader>
        <DialogTitle>{{ t('newProduct') }}</DialogTitle>
        <DialogDescription>{{ t('imagesHint') }}</DialogDescription>
      </DialogHeader>
      <ProductDetailsForm v-if="open" :store-id="storeId" @busy="busy = $event" @cancel="close(false)"
        @saved="$emit('saved', $event)" />
    </DialogContent>
  </Dialog>
</template>
