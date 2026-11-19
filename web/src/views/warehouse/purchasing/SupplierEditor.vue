<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { SupplierRecord } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Checkbox } from '@lingdian/console-ui/input'
import { Input } from '@lingdian/console-ui/input'
import { Textarea } from '@lingdian/console-ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { saveSupplier } from '@/services/purchasing'
import { errorKey, usePurchasingLocale, type Key } from './locale'
const props = defineProps<{ open: boolean; storeId: string; supplier?: SupplierRecord }>(),
  emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()
const { t } = usePurchasingLocale(),
  form = reactive({ code: '', name: '', contact: '', note: '', isActive: true }),
  saving = ref(false),
  error = ref<Key>()
watch(
  () => props.open,
  (open) => {
    if (open) {
      Object.assign(
        form,
        props.supplier
          ? {
              code: props.supplier.code,
              name: props.supplier.name,
              contact: props.supplier.contact,
              note: props.supplier.note,
              isActive: props.supplier.isActive,
            }
          : { code: '', name: '', contact: '', note: '', isActive: true },
      )
      error.value = undefined
    }
  },
)
function close(open: boolean) {
  if (!saving.value) emit('update:open', open)
}
async function submit() {
  if (saving.value) return
  saving.value = true
  error.value = undefined
  try {
    await saveSupplier(
      props.storeId,
      { ...form, code: form.code.trim(), name: form.name.trim(), contact: form.contact.trim(), note: form.note.trim() },
      props.supplier?.id,
      props.supplier?.version,
    )
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    error.value = errorKey(e)
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="max-h-[92dvh] max-w-lg overflow-y-auto" :close-label="t('close')" :close-disabled="saving">
      <DialogHeader>
        <DialogTitle>{{ t(supplier ? 'edit' : 'newSupplier') }}</DialogTitle>
        <DialogDescription>{{ t('supplierHint') }}</DialogDescription>
      </DialogHeader>
      <form class="purchase-form" @submit.prevent="submit">
        <fieldset :disabled="saving" class="grid min-w-0 gap-4">
          <label>
            {{ t('code') }}
            <Input v-model="form.code" pattern="[A-Za-z0-9_-]{1,64}" maxlength="64" required />
          </label>
          <label>
            {{ t('name') }}
            <Input v-model="form.name" maxlength="120" required />
          </label>
          <label>
            {{ t('contact') }}
            <Input v-model="form.contact" maxlength="191" />
          </label>
          <label>
            {{ t('note') }}
            <Textarea v-model="form.note" maxlength="240" rows="2" />
          </label>
          <label class="check">
            <Checkbox v-model="form.isActive" class="accent-primary" />
            {{ t('enabled') }}
          </label>
        </fieldset>
        <p v-if="error" role="alert" class="error">{{ t(error) }}</p>
        <div class="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" :disabled="saving" @click="close(false)">{{ t('cancel') }}</Button>
          <Button type="submit" :disabled="saving">{{ t(saving ? 'saving' : 'save') }}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
<style scoped src="./purchasing.css"></style>
