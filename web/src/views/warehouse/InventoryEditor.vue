<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { InventoryItemContract, InventoryAdjustmentKind } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { useLocale } from '@/i18n/locale'
import { adjustInventory, createInventoryItem } from '@/services/inventory'
import { en, zh, type MessageKey } from './messages'

const props = defineProps<{ open: boolean; storeId: string; item?: InventoryItemContract }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()
const { locale } = useLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const form = reactive({ code: '', name: '', unit: '', reorderPoint: 0, kind: 'RECEIVE' as InventoryAdjustmentKind, amount: 0, reason: '' })
const saving = ref(false)
const errorKey = ref<MessageKey | ''>('')
let pending: { signature: string; requestId: string } | undefined
const operationKeys: Record<InventoryAdjustmentKind, MessageKey> = { RECEIVE: 'receive', ISSUE: 'issue', LOSS: 'loss', COUNT: 'count', THRESHOLD: 'setThreshold' }
const predicted = computed(() => {
  const before = props.item?.quantity ?? 0
  return form.kind === 'RECEIVE' ? before + Number(form.amount) : form.kind === 'ISSUE' || form.kind === 'LOSS' ? before - Number(form.amount) : form.kind === 'COUNT' ? Number(form.amount) : before
})
watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, { code: '', name: '', unit: '', reorderPoint: 0, kind: 'RECEIVE', amount: 0, reason: '' })
  errorKey.value = ''
  pending = undefined
})
function setOpen(value: boolean) { if (!saving.value) emit('update:open', value) }
async function submit() {
  if (saving.value) return
  saving.value = true
  errorKey.value = ''
  try {
    if (props.item) {
      const data = { kind: form.kind, amount: Number(form.amount), reason: form.reason.trim(), expectedVersion: props.item.version }
      const signature = JSON.stringify(data)
      if (pending?.signature !== signature) pending = { signature, requestId: crypto.randomUUID() }
      await adjustInventory(props.storeId, props.item.id, { ...data, requestId: pending.requestId })
    } else {
      await createInventoryItem(props.storeId, { code: form.code.trim(), name: form.name.trim(), unit: form.unit.trim(), reorderPoint: Number(form.reorderPoint) })
    }
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    errorKey.value = Object.hasOwn(zh, message) ? message as MessageKey : 'unexpected'
  } finally { saving.value = false }
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-h-[90dvh] max-w-lg overflow-y-auto" :close-label="t('cancel')" @interact-outside="saving && $event.preventDefault()" @escape-key-down="saving && $event.preventDefault()">
      <DialogHeader>
        <DialogTitle>{{ item ? `${t('adjust')} · ${item.name}` : t('createTitle') }}</DialogTitle>
        <DialogDescription>{{ item ? `${item.code} · ${item.unit}` : t('createHint') }}</DialogDescription>
      </DialogHeader>
      <form class="inventory-form" @submit.prevent="submit">
        <fieldset :disabled="saving" class="grid min-w-0 gap-4">
          <template v-if="!item">
            <label>{{ t('code') }}<input v-model="form.code" required maxlength="64" pattern="[A-Za-z0-9_-]{1,64}" :placeholder="t('codeHint')" autocomplete="off" /></label>
            <label>{{ t('name') }}<input v-model="form.name" required maxlength="120" /></label>
            <label>{{ t('unit') }}<input v-model="form.unit" required maxlength="16" :placeholder="t('unitHint')" /></label>
            <label>{{ t('threshold') }}<input v-model="form.reorderPoint" type="number" min="0" max="999999" step="0.001" required /></label>
            <p class="help">{{ t('thresholdHint') }}</p>
          </template>
          <template v-else>
            <label>{{ t('operation') }}<select v-model="form.kind" :aria-label="t('operation')"><option v-for="(key, kind) in operationKeys" :key="kind" :value="kind">{{ t(key) }}</option></select></label>
            <label>{{ t(form.kind === 'COUNT' ? 'actual' : form.kind === 'THRESHOLD' ? 'threshold' : 'amount') }} ({{ item.unit }})
              <input v-model="form.amount" type="number" :min="form.kind === 'RECEIVE' || form.kind === 'ISSUE' || form.kind === 'LOSS' ? 0.001 : 0" :max="form.kind === 'ISSUE' || form.kind === 'LOSS' ? (item.availableQuantity ?? item.quantity) : 999999" step="0.001" required />
            </label>
            <p class="help">{{ t('available') }}: {{ (item.availableQuantity ?? item.quantity).toLocaleString(locale) }} {{ item.unit }} · {{ t('reserved') }}: {{ (item.reservedQuantity ?? 0).toLocaleString(locale) }} {{ item.unit }}</p>
            <p class="help">{{ t(form.kind === 'COUNT' ? 'countHint' : form.kind === 'THRESHOLD' ? 'thresholdHint' : 'precision') }}</p>
            <div class="rounded-md bg-muted p-3 text-sm tabular-nums" aria-live="polite">
              {{ t('before') }}: {{ item.quantity.toLocaleString(locale) }} → {{ t('after') }}: {{ predicted.toLocaleString(locale, { maximumFractionDigits: 3 }) }} {{ item.unit }}
              <p v-if="form.kind === 'THRESHOLD'" class="mt-1">{{ t('threshold') }}: {{ item.reorderPoint.toLocaleString(locale) }} → {{ Number(form.amount).toLocaleString(locale) }}</p>
            </div>
            <label>{{ t('reason') }}<textarea v-model="form.reason" required maxlength="240" rows="3" :placeholder="t('reasonHint')" /></label>
          </template>
        </fieldset>
        <p v-if="errorKey" role="alert" class="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{{ t(errorKey) }}</p>
        <p v-if="item && errorKey === 'unexpected'" class="help">{{ t('retryHint') }}</p>
        <div class="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" :disabled="saving" @click="setOpen(false)">{{ t('cancel') }}</Button>
          <Button type="submit" :disabled="saving">{{ t(saving ? 'saving' : 'save') }}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.inventory-form { display: grid; gap: 1rem; }
label { display: grid; gap: .5rem; font-size: .875rem; font-weight: 500; }
input, select, textarea { width: 100%; min-width: 0; padding: .625rem .75rem; border: 1px solid var(--ld-border-default); border-radius: .375rem; background: var(--ld-bg-elevated); color: var(--ld-text-heading); font-weight: 400; }
input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--ld-color-primary); outline-offset: 2px; }
.help { font-size: .8125rem; color: var(--ld-text-muted); line-height: 1.5; }
</style>
