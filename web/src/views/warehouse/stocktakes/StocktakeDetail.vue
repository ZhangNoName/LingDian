<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { StocktakeRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { getStocktake, saveStocktake, stocktakeAction } from '@/services/stocktakes'
import { downloadCsv } from '../report'
import { countDraft, countValue, countsChanged, validCount, type CountInput } from './counts'
import { useStocktakeLocale, errorKey, type Key } from './locale'
const props = defineProps<{ id: string; storeId: string; storeName: string }>(),
  emit = defineEmits<{ close: []; saved: [] }>(),
  { t, number, date } = useStocktakeLocale()
const record = ref<StocktakeRecord>(),
  counts = ref<Record<string, CountInput>>({}),
  loading = ref(true),
  failed = ref(false),
  saving = ref(false),
  error = ref<Key>(),
  confirmation = ref<'post' | 'cancel' | 'recount'>(),
  notice = ref(false),
  closePending = ref(false)
const dirty = computed(() => !!record.value && countsChanged(record.value.lines, counts.value)),
  complete = computed(() => record.value?.lines.every((line) => line.countedQuantity !== null)),
  stockChanged = computed(() => record.value?.lines.some((line) => line.itemVersion !== line.currentVersion)),
  belowReserved = computed(() =>
    record.value?.lines.some((line) => line.countedQuantity !== null && line.countedQuantity < line.currentReserved),
  ),
  editable = computed(() => record.value?.status === 'DRAFT')
watch(dirty, value => { if (value) notice.value = false })
let sequence = 0,
  disposed = false
function accept(row: StocktakeRecord) {
  closePending.value = false
  record.value = row
  counts.value = countDraft(row.lines)
  confirmation.value = undefined
}
async function load() {
  const current = ++sequence
  loading.value = true
  failed.value = false
  error.value = undefined
  try {
    const row = await getStocktake(props.storeId, props.id)
    if (current === sequence) accept(row)
  } catch {
    if (current === sequence) failed.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => [props.id, props.storeId],
  () => {
    record.value = undefined
    void load()
  },
  { immediate: true },
)
function close(open: boolean) {
  if (open || saving.value) return
  if (dirty.value) closePending.value = true
  else emit('close')
}
function leave() {
  emit('close')
}
function discard() {
  if (record.value) counts.value = countDraft(record.value.lines)
  error.value = undefined
}
function choose(action: 'post' | 'cancel' | 'recount') {
  confirmation.value = action
  error.value = undefined
}
async function save() {
  if (!record.value || saving.value) return
  if (Object.values(counts.value).some((value) => !validCount(value))) {
    error.value = 'invalidLines'
    return
  }
  saving.value = true
  error.value = undefined
  try {
    const result = await saveStocktake(props.storeId, props.id, {
      expectedVersion: record.value.version,
      lines: record.value.lines.map((line) => ({
        lineId: line.id,
        countedQuantity: countValue(counts.value[line.id] ?? ''),
      })),
    })
    if (!disposed) {
      accept(result)
      notice.value = true
      emit('saved')
    }
  } catch (e) {
    if (!disposed) error.value = errorKey(e)
  } finally {
    saving.value = false
  }
}
async function act() {
  if (!record.value || !confirmation.value || saving.value || dirty.value) return
  saving.value = true
  error.value = undefined
  try {
    const result = await stocktakeAction(props.storeId, props.id, confirmation.value, record.value.version)
    if (!disposed) {
      accept(result)
      notice.value = true
      emit('saved')
    }
  } catch (e) {
    if (!disposed) error.value = errorKey(e)
  } finally {
    saving.value = false
  }
}
function variance(expected: number, value: CountInput) {
  const count = countValue(value)
  return count === null || !validCount(value) ? '—' : number(Math.round((count - expected) * 1000) / 1000)
}
function exportRecord() {
  const row = record.value
  if (!row || dirty.value || saving.value || failed.value) return
  const data: (string | number)[][] = [
    [t('store'), props.storeName, props.storeId],
    [t('title'), row.title, row.id],
    [t('status'), t(row.status)],
    [t('note'), row.note],
    [t('created'), row.createdAt, row.createdBy],
    [t('posted'), row.postedAt ?? '', row.postedBy ?? ''],
    [t('countedAt')],
    [t('code'), t('material'), t('unit'), t('captured'), t('expected'), t('reservedQty'), t('counted'), t('variance')],
  ]
  for (const line of row.lines)
    data.push([
      line.itemCode,
      line.itemName,
      line.unit,
      line.capturedAt,
      line.expectedQuantity,
      line.reservedQuantity,
      line.countedQuantity ?? '',
      line.countedQuantity === null ? '' : Math.round((line.countedQuantity - line.expectedQuantity) * 1000) / 1000,
    ])
  downloadCsv(`stocktake-${row.id}.csv`, data)
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <Dialog :open="!!id" @update:open="close"
    ><DialogContent class="max-h-[92dvh] max-w-4xl overflow-y-auto" :close-label="t('close')" :close-disabled="saving"
      ><DialogHeader
        ><DialogTitle>{{ record?.title ?? t('title') }}</DialogTitle
        ><DialogDescription>{{ t(editable ? 'draftSummary' : 'recordSummary') }}</DialogDescription></DialogHeader
      >
      <p v-if="loading" role="status" class="help">{{ t('loading') }}</p>
      <div v-else-if="failed" role="alert">
        <p>{{ t('failed') }}</p>
        <Button variant="outline" @click="load">{{ t('reload') }}</Button>
      </div>
      <div v-else-if="record" class="grid min-w-0 gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong class="text-sm"
            >{{ t(record.status) }} · {{ t('progress') }}
            {{ record.lines.filter((line) => line.countedQuantity !== null).length }} /
            {{ record.lines.length }}</strong
          >
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="saving || dirty" @click="load">{{ t('reload') }}</Button
            ><Button size="sm" variant="outline" :disabled="saving || dirty" @click="exportRecord">{{
              t('export')
            }}</Button>
          </div>
        </div>
        <p class="text-sm whitespace-pre-wrap break-words">{{ record.note }}</p>
        <p class="help">
          {{ t('created') }}: {{ date(record.createdAt)
          }}<span v-if="record.postedAt"> · {{ t('posted') }}: {{ date(record.postedAt) }}</span>
        </p>
        <p v-if="notice" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
        <p v-if="dirty" role="status" class="text-sm text-amber-800">
          {{ t('dirty') }}
          <Button type="button" size="sm" variant="ghost" :disabled="saving" @click="discard">{{
            t('discard')
          }}</Button>
        </p>
        <p v-if="editable && stockChanged" role="alert" class="text-sm text-amber-800">{{ t('stockChanged') }}</p>
        <p v-if="editable" class="help">{{ t('draftHint') }}</p>
        <details v-if="editable" class="help"><summary class="cursor-pointer">{{ t('rules') }}</summary><p class="mt-2">{{ t('stockHint') }}</p></details>
        <form class="grid min-w-0 gap-4" @submit.prevent="save">
          <fieldset class="grid min-w-0 gap-3" :disabled="saving || !!confirmation || !editable">
            <div
              v-for="line in record.lines"
              :key="line.id"
              class="grid min-w-0 gap-3 rounded-md border p-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div class="min-w-0">
                <strong class="break-words">{{ line.itemName }}</strong>
                <p class="help mt-1">{{ line.itemCode }} · {{ line.unit }}</p>
                <p class="mt-2 tabular-nums">
                  {{ t('expected') }}: {{ number(line.expectedQuantity) }} · {{ t('reservedQty') }}:
                  {{ number(line.reservedQuantity) }}
                </p>
                <p class="help mt-1">{{ t('captured') }}: {{ date(line.capturedAt) }}</p>
                <p v-if="editable && line.currentVersion !== line.itemVersion" class="mt-2 text-amber-800">
                  {{ t('changed') }} · {{ t('current') }}: {{ number(line.currentQuantity) }} {{ line.unit }} ·
                  {{ t('reservedQty') }}: {{ number(line.currentReserved) }}
                </p>
              </div>
              <div class="grid content-start gap-2">
                <label
                  >{{ t('counted') }} ({{ line.unit }})<input
                    v-model="counts[line.id]"
                    type="number"
                    min="0"
                    max="999999"
                    step="0.001"
                    :aria-label="`${t('counted')} ${line.itemName}`"
                /></label>
                <p class="tabular-nums">
                  {{ t('variance') }}: {{ variance(line.expectedQuantity, counts[line.id] ?? '') }} {{ line.unit }}
                </p>
              </div>
            </div>
          </fieldset>
          <div v-if="editable" class="flex justify-end">
            <Button :disabled="saving || !!confirmation || !dirty">{{ t(saving ? 'saving' : 'save') }}</Button>
          </div>
        </form>
        <div v-if="editable && !confirmation" class="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" :disabled="saving || dirty" @click="choose('cancel')">{{
            t('cancelCount')
          }}</Button
          ><Button type="button" variant="outline" :disabled="saving || dirty" @click="choose('recount')">{{
            t('recount')
          }}</Button
          ><Button
            type="button"
            :disabled="saving || dirty || !complete || stockChanged || belowReserved"
            @click="choose('post')"
            >{{ t('post') }}</Button
          >
        </div>
        <p v-if="editable && belowReserved" role="alert" class="error">{{ t('reserved') }}</p>
        <div v-if="confirmation" class="grid gap-3 rounded-md border p-3">
          <p class="text-sm">
            {{ t(confirmation === 'post' ? 'postHint' : confirmation === 'cancel' ? 'cancelHint' : 'recountHint') }}
          </p>
          <div class="flex flex-wrap justify-end gap-2">
            <Button variant="outline" :disabled="saving" @click="confirmation = undefined">{{ t('cancel') }}</Button
            ><Button :disabled="saving" @click="act">{{ t(saving ? 'saving' : 'confirm') }}</Button>
          </div>
        </div>
        <p v-if="error" role="alert" class="error">{{ t(error) }}</p>
        <div v-if="closePending" role="alert" class="grid gap-3 rounded-md border p-3">
          <p class="text-sm">{{ t('closeHint') }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <Button variant="outline" @click="closePending = false">{{ t('keepEditing') }}</Button
            ><Button variant="outline" @click="leave">{{ t('discardClose') }}</Button>
          </div>
        </div>
        <Button variant="outline" class="justify-self-end" :disabled="saving" @click="close(false)">{{
          t('close')
        }}</Button>
      </div></DialogContent
    ></Dialog
  >
</template>
<style scoped src="../purchasing/purchasing.css"></style>
