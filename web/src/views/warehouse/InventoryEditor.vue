<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { InventoryItemContract, InventoryAdjustmentKind } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { Textarea } from '@lingdian/console-ui/textarea'
import { SelectField } from '@lingdian/console-ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
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
let sequence = 0
let pending: { signature: string; requestId: string } | undefined
const operationKeys: Record<InventoryAdjustmentKind, MessageKey> = { RECEIVE: 'receive', ISSUE: 'issue', LOSS: 'loss', COUNT: 'count', THRESHOLD: 'setThreshold' }
const operationKinds = Object.keys(operationKeys) as InventoryAdjustmentKind[]
const predicted = computed(() => {
  const before = props.item?.quantity ?? 0
  return form.kind === 'RECEIVE' ? before + Number(form.amount) : form.kind === 'ISSUE' || form.kind === 'LOSS' ? before - Number(form.amount) : form.kind === 'COUNT' ? Number(form.amount) : before
})
watch([() => props.open, () => props.storeId, () => props.item?.id], ([open]) => {
  sequence++
  if (!open) return
  saving.value = false
  Object.assign(form, { code: '', name: '', unit: '', reorderPoint: 0, kind: 'RECEIVE', amount: 0, reason: '' })
  errorKey.value = ''
  pending = undefined
})
function setOpen(value: boolean) { if (!saving.value) emit('update:open', value) }
async function submit() {
  if (saving.value) return
  const token = sequence
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
    if (token !== sequence) return
    emit('saved')
    emit('update:open', false)
  } catch (error) {
    if (token !== sequence) return
    const message = error instanceof Error ? error.message : ''
    errorKey.value = Object.hasOwn(zh, message) ? message as MessageKey : 'unexpected'
  } finally { if (token === sequence) saving.value = false }
}
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-h-[90dvh] max-w-lg overflow-y-auto" :close-label="t('cancel')" :close-disabled="saving" @interact-outside="saving && $event.preventDefault()" @escape-key-down="saving && $event.preventDefault()">
      <DialogHeader>
        <DialogTitle>{{ item ? `${t('adjust')} · ${item.name}` : t('createTitle') }}</DialogTitle>
        <DialogDescription>{{ item ? `${item.code} · ${item.unit}` : t('createHint') }}</DialogDescription>
      </DialogHeader>
      <form class="inventory-form" @submit.prevent="submit">
        <fieldset :disabled="saving" class="grid min-w-0 gap-4">
          <template v-if="!item">
            <label>{{ t('code') }}<Input v-model="form.code" required maxlength="64" pattern="[A-Za-z0-9_-]{1,64}" :placeholder="t('codeHint')" autocomplete="off" /></label>
            <label>{{ t('name') }}<Input v-model="form.name" required maxlength="120" /></label>
            <label>{{ t('unit') }}<Input v-model="form.unit" required maxlength="16" :placeholder="t('unitHint')" /></label>
            <label>{{ t('threshold') }}<Input v-model="form.reorderPoint" type="number" min="0" max="999999" step="0.001" required /></label>
            <p class="help">{{ t('thresholdHint') }}</p>
          </template>
          <template v-else>
            <label>{{ t('operation') }}<SelectField
                v-model="form.kind"
                :aria-label="t('operation')"
                :options="operationKinds.map((value) => ({ value, label: t(operationKeys[value]) }))"
              /></label>
            <label>{{ t(form.kind === 'COUNT' ? 'actual' : form.kind === 'THRESHOLD' ? 'threshold' : 'amount') }} ({{ item.unit }})
              <Input v-model="form.amount" type="number" :min="form.kind === 'RECEIVE' || form.kind === 'ISSUE' || form.kind === 'LOSS' ? 0.001 : 0" :max="form.kind === 'ISSUE' || form.kind === 'LOSS' ? (item.availableQuantity ?? item.quantity) : 999999" step="0.001" required />
            </label>
            <p class="help">{{ t('available') }}: {{ (item.availableQuantity ?? item.quantity).toLocaleString(locale) }} {{ item.unit }} · {{ t('reserved') }}: {{ (item.reservedQuantity ?? 0).toLocaleString(locale) }} {{ item.unit }}</p>
            <p class="help">{{ t(form.kind === 'COUNT' ? 'countHint' : form.kind === 'THRESHOLD' ? 'thresholdHint' : 'precision') }}</p>
            <div class="rounded-md bg-muted p-3 text-sm tabular-nums" aria-live="polite">
              {{ t('before') }}: {{ item.quantity.toLocaleString(locale) }} → {{ t('after') }}: {{ predicted.toLocaleString(locale, { maximumFractionDigits: 3 }) }} {{ item.unit }}
              <p v-if="form.kind === 'THRESHOLD'" class="mt-1">{{ t('threshold') }}: {{ item.reorderPoint.toLocaleString(locale) }} → {{ Number(form.amount).toLocaleString(locale) }}</p>
            </div>
            <label>{{ t('reason') }}<Textarea v-model="form.reason" required maxlength="240" rows="3" :placeholder="t('reasonHint')" /></label>
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
.help { font-size: .8125rem; color: var(--ld-text-muted); line-height: 1.5; }
</style>
