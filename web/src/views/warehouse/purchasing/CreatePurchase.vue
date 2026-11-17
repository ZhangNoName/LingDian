<script setup lang="ts">
import { ref, watch } from 'vue'
import type { InventoryItemContract, SupplierRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { supplierList, createPurchase } from '@/services/purchasing'
import { listInventory } from '@/services/inventory'
import { errorKey, usePurchasingLocale, type Key } from './locale'
const props = defineProps<{ open: boolean; storeId: string }>(),
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
  lines = ref<Array<{ item: InventoryItemContract; quantity: number; unitPrice: number }>>([])
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
      void lookup('both')
    }
  },
)
async function lookup(kind: 'supplier' | 'material' | 'both') {
  const current = ++lookupSequence
  finding.value = true
  error.value = undefined
  try {
    const [a, b] = await Promise.all([
      kind !== 'material' ? supplierList(props.storeId, 1, supplierKeyword.value.trim(), true) : null,
      kind !== 'supplier'
        ? listInventory(props.storeId, { page: 1, pageSize: 20, keyword: materialKeyword.value.trim() })
        : null,
    ])
    if (current === lookupSequence) {
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
function add() {
  const item = items.value.find((item) => item.id === selectedItem.value)
  if (item && !lines.value.some((line) => line.item.id === item.id) && lines.value.length < 50)
    lines.value.push({ item, quantity: Math.max(0.001, item.shortage), unitPrice: 0 })
  selectedItem.value = ''
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
    emit('saved', result.id)
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
              <input
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
            <select v-model="supplier" :aria-label="t('supplier')" required>
              <option value="">{{ t('choose') }}</option>
              <option v-for="record in suppliers" :key="record.id" :value="record.id">
                {{ record.code }} · {{ record.name }}
              </option>
            </select>
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label>
              {{ t('expectedAt') }}
              <input v-model="expectedAt" type="date" />
            </label>
            <label>
              {{ t('note') }}
              <input v-model="note" maxlength="240" />
            </label>
          </div>
          <hr />
          <div class="flex items-end gap-2">
            <label class="grow">
              {{ t('materialSearch') }}
              <input
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
              <select v-model="selectedItem" :aria-label="t('material')">
                <option value="">{{ t('choose') }}</option>
                <option
                  v-for="item in items"
                  :key="item.id"
                  :value="item.id"
                  :disabled="lines.some((line) => line.item.id === item.id)"
                >
                  {{ item.code }} · {{ item.name }} ({{ item.unit }})
                </option>
              </select>
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
          <div v-for="line in lines" :key="line.item.id" class="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
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
            <label>
              {{ t('quantity') }}
              <input
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
              <input
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
