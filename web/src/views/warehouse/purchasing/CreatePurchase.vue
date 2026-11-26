<script setup lang="ts">
import MerchantDatePicker from '@/components/MerchantDatePicker.vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import type { InventoryItemContract, SupplierRecord, ReplenishmentRow } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SearchSelectField } from '@lingdian/console-ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { supplierList, createPurchase, replenishmentSnapshot } from '@/services/purchasing'
import { listInventory } from '@/services/inventory'
import { errorKey, usePurchasingLocale, type Key } from './locale'
const props = defineProps<{ open: boolean; storeId: string; seedItem?: ReplenishmentRow }>(),
  emit = defineEmits<{ 'update:open': [boolean]; saved: [id: string] }>()
const { t } = usePurchasingLocale(),
  suppliers = ref<SupplierRecord[]>([]),
  items = ref<InventoryItemContract[]>([]),
  supplier = ref(''),
  selectedItem = ref(''),
  supplierKeyword = ref(''),
  materialKeyword = ref(''),
  expectedAt = ref(''),
  note = ref(''),
  saving = ref(false),
  finding = ref(false),
  error = ref<Key>(),
  lines = ref<Array<{ item: InventoryItemContract; quantity: number; unitPrice: number; pendingQuantity: number }>>([])
let disposed = false
let requestId = '',
  lookupSequence = 0
watch(
  () => props.open,
  (open) => {
    lookupSequence++
    if (open) {
      supplier.value = ''
      selectedItem.value = ''
      supplierKeyword.value = ''
      materialKeyword.value = ''
      expectedAt.value = ''
      note.value = ''
      lines.value = []
      requestId = crypto.randomUUID()
      error.value = undefined
      void lookup('both', props.seedItem?.id)
    }
  },
)
async function lookup(kind: 'supplier' | 'material' | 'both', seedId?: string) {
  const current = ++lookupSequence
  finding.value = true
  error.value = undefined
  try {
    const [a, b, seed] = await Promise.all([
      kind !== 'material' ? supplierList(props.storeId, 1, supplierKeyword.value.trim(), true) : null,
      kind !== 'supplier'
        ? listInventory(props.storeId, { page: 1, pageSize: 20, keyword: materialKeyword.value.trim() })
        : null,
      seedId ? replenishmentSnapshot(props.storeId, { itemId: seedId }) : null,
    ])
    if (current === lookupSequence) {
      if (seed) {
        const row = seed.rows[0]
        if (row)
          lines.value = [
            { item: row, quantity: row.recommendedQuantity, unitPrice: 0, pendingQuantity: row.pendingQuantity },
          ]
        else error.value = 'materialUnavailable'
      }
      if (a) {
        suppliers.value = a.items
        if (!a.items.some((record) => record.id === supplier.value)) supplier.value = ''
      }
      if (b) {
        items.value = b.items
        if (!b.items.some((record) => record.id === selectedItem.value)) selectedItem.value = ''
      }
    }
  } catch {
    if (current === lookupSequence) error.value = 'failed'
  } finally {
    if (current === lookupSequence) finding.value = false
  }
}
async function add() {
  const id = selectedItem.value
  if (!id || finding.value || lines.value.some((line) => line.item.id === id) || lines.value.length >= 50) return
  const current = ++lookupSequence
  finding.value = true
  error.value = undefined
  try {
    const snapshot = await replenishmentSnapshot(props.storeId, { itemId: id })
    if (current !== lookupSequence) return
    const row = snapshot.rows[0]
    if (!row) {
      error.value = 'materialUnavailable'
      return
    }
    lines.value.push({
      item: row,
      quantity: row.recommendedQuantity,
      unitPrice: 0,
      pendingQuantity: row.pendingQuantity,
    })
    selectedItem.value = ''
  } catch {
    if (current === lookupSequence) error.value = 'failed'
  } finally {
    if (current === lookupSequence) finding.value = false
  }
}
function close(open: boolean) {
  if (!saving.value) emit('update:open', open)
}
async function submit() {
  if (saving.value) return
  if (!supplier.value || !lines.value.length) {
    error.value = lines.value.length ? 'supplierUnavailable' : 'missingLines'
    return
  }
  saving.value = true
  error.value = undefined
  try {
    const result = await createPurchase(props.storeId, {
      requestId,
      supplierId: supplier.value,
      note: note.value.trim(),
      ...(expectedAt.value ? { expectedAt: new Date(expectedAt.value + 'T00:00:00').toISOString() } : {}),
      lines: lines.value.map((line) => ({ itemId: line.item.id, quantity: line.quantity, unitPrice: line.unitPrice })),
    })
    if (disposed || !props.open) return
    emit('saved', result.id)
    emit('update:open', false)
  } catch (e) {
    error.value = errorKey(e)
  } finally {
    saving.value = false
  }
}
onBeforeUnmount(() => {
  disposed = true
  lookupSequence++
})
</script>
<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="max-h-[92dvh] max-w-3xl overflow-y-auto" :close-label="t('close')" :close-disabled="saving">
      <DialogHeader>
        <DialogTitle>{{ t('newOrder') }}</DialogTitle>
        <DialogDescription>{{ t('creationHint') }}</DialogDescription>
      </DialogHeader>
      <form class="purchase-form" @submit.prevent="submit">
        <fieldset :disabled="saving" class="grid min-w-0 gap-4">
          <div class="flex items-end gap-2">
            <label class="grow">
              {{ t('supplierSearch') }}
              <Input
                v-model="supplierKeyword"
                @keydown.enter.prevent="lookup('supplier')"
                type="search"
                maxlength="120"
              />
            </label>
            <Button type="button" variant="outline" :disabled="finding" @click="lookup('supplier')">
              {{ t('find') }}
            </Button>
          </div>
          <label>
            {{ t('supplier') }}
            <SearchSelectField
              v-model="supplier"
              :aria-label="t('supplier')"
              required
              :options="[
                { value: '', label: t('choose') },
                ...suppliers.map((record) => ({ value: record.id, label: `${record.code} · ${record.name}` })),
              ]"
            />
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <MerchantDatePicker :label="t('expectedAt')" v-model="expectedAt" />
            <label>
              {{ t('note') }}
              <Input v-model="note" maxlength="240" />
            </label>
          </div>
          <hr />
          <div class="flex items-end gap-2">
            <label class="grow">
              {{ t('materialSearch') }}
              <Input
                v-model="materialKeyword"
                @keydown.enter.prevent="lookup('material')"
                type="search"
                maxlength="120"
              />
            </label>
            <Button type="button" variant="outline" :disabled="finding" @click="lookup('material')">
              {{ t('find') }}
            </Button>
          </div>
          <div class="flex gap-2">
            <label class="grow">
              <span class="sr-only">{{ t('material') }}</span>
              <SearchSelectField
                v-model="selectedItem"
                :aria-label="t('material')"
                :options="[
                  { value: '', label: t('choose') },
                  ...items.map((item) => ({ value: item.id, label: `${item.code} · ${item.name} (${item.unit})`, disabled: lines.some((line) => line.item.id === item.id) })),
                ]"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              :disabled="!selectedItem || lines.length >= 50 || finding"
              @click="add"
            >
              {{ t('add') }}
            </Button>
          </div>
          <p class="help">{{ t('lookupHint') }}</p>
          <p v-if="finding" role="status" class="help">{{ t('loading') }}</p>
          <div v-for="line in lines" :key="line.item.id" class="grid gap-3 border p-3 sm:grid-cols-2">
            <div class="flex items-center justify-between gap-3 sm:col-span-2">
              <p class="break-words text-sm font-medium">
                {{ line.item.code }} · {{ line.item.name }} ({{ line.item.unit }})
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                :aria-label="`${t('remove')} ${line.item.name}`"
                @click="lines = lines.filter((value) => value !== line)"
              >
                {{ t('remove') }}
              </Button>
            </div>
            <p class="help sm:col-span-2">
              {{ t('pending') }}: {{ line.pendingQuantity }} {{ line.item.unit }} · {{ t('pendingHint') }}
            </p>
            <label>
              {{ t('quantity') }}
              <Input
                v-model.number="line.quantity"
                :aria-label="`${t('quantity')} ${line.item.name}`"
                type="number"
                min="0.001"
                max="999999"
                step="0.001"
                required
              />
            </label>
            <label>
              {{ t('unitPrice') }}
              <Input
                v-model.number="line.unitPrice"
                :aria-label="`${t('unitPrice')} ${line.item.name}`"
                type="number"
                min="0"
                max="999999.99"
                step="0.01"
                required
              />
            </label>
          </div>
        </fieldset>
        <p v-if="error" role="alert" class="error">{{ t(error) }}</p>
        <div class="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" :disabled="saving" @click="close(false)">{{ t('cancel') }}</Button>
          <Button type="submit" :disabled="saving || finding">{{ t(saving ? 'saving' : 'save') }}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
<style scoped src="./purchasing.css"></style>
