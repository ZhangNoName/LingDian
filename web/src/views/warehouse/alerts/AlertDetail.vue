<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { InventoryAlertRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { useLocale } from '@/i18n/locale'
import { acknowledgeInventoryAlert, getInventoryAlert } from '@/services/inventory'
import { useLifecycleLocale } from '../lifecycle/locale'
import { alertEn, alertZh, type AlertMessageKey } from '../alert-messages'
const props = defineProps<{ storeId: string; id: string }>(),
  emit = defineEmits<{
    close: []
    saved: []
    stock: [code: string, lifecycle: 'ACTIVE' | 'ARCHIVED']
    replenish: [itemId: string]
  }>()
const { locale } = useLocale(),
  { t: lt } = useLifecycleLocale()
const t = (key: AlertMessageKey) => (locale.value === 'en-US' ? alertEn : alertZh)[key]
const stateKey = { OPEN: 'open', ACKNOWLEDGED: 'acknowledged', RESOLVED: 'resolved' } as const
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value),
      )
    : '—'
const row = ref<InventoryAlertRecord>(),
  note = ref(''),
  loading = ref(true),
  failed = ref(false),
  saving = ref(false),
  stale = ref(false),
  reloaded = ref(false),
  recorded = ref(false),
  formError = ref<AlertMessageKey>()
const busy = computed(() => loading.value || saving.value)
let sequence = 0
async function load(refresh = false) {
  if (saving.value) return
  const token = ++sequence
  loading.value = true
  failed.value = false
  formError.value = undefined
  reloaded.value = false
  recorded.value = false
  try {
    const data = await getInventoryAlert(props.storeId, props.id)
    if (data.storeId !== props.storeId || data.id !== props.id) throw new Error('inventory.alertNotFound')
    if (token === sequence) {
      row.value = data
      stale.value = false
      reloaded.value = refresh
    }
  } catch {
    if (token === sequence) failed.value = true
  } finally {
    if (token === sequence) loading.value = false
  }
}
watch(
  [() => props.storeId, () => props.id],
  () => {
    row.value = undefined
    note.value = ''
    stale.value = false
    recorded.value = false
    void load()
  },
  { immediate: true },
)
function close() {
  if (!saving.value) emit('close')
}
async function acknowledge() {
  if (
    !row.value ||
    busy.value ||
    failed.value ||
    stale.value ||
    row.value.status !== 'OPEN' ||
    !note.value.trim()
  )
    return
  saving.value = true
  formError.value = undefined
  const token = sequence
  try {
    const result = await acknowledgeInventoryAlert(props.storeId, props.id, {
      expectedVersion: row.value.version,
      note: note.value.trim(),
    })
    if (token === sequence) {
      row.value = result
      note.value = ''
      recorded.value = true
      reloaded.value = false
      emit('saved')
    }
  } catch (error) {
    if (token === sequence) {
      stale.value =
        error instanceof Error && ['inventory.alertStale', 'inventory.alertNotFound'].includes(error.message)
      formError.value = stale.value ? 'stale' : 'unexpected'
    }
  } finally {
    if (token === sequence) saving.value = false
  }
}
function stock() {
  if (row.value && !busy.value && !failed.value)
    emit('stock', row.value.code, row.value.itemIsActive === false ? 'ARCHIVED' : 'ACTIVE')
}
function replenish() {
  if (row.value && !busy.value && !failed.value && row.value.status !== 'RESOLVED')
    emit('replenish', row.value.itemId)
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <Dialog open @update:open="close"
    ><DialogContent
      class="max-h-[90dvh] max-w-xl overflow-y-auto"
      :close-label="t('close')"
      :close-disabled="saving"
      @escape-key-down="saving && $event.preventDefault()"
      @interact-outside="saving && $event.preventDefault()"
    >
      <DialogHeader
        ><DialogTitle>{{ row ? row.name + ' · ' : '' }}{{ t('title') }}</DialogTitle
        ><DialogDescription>{{ t('snapshot') }}</DialogDescription></DialogHeader
      >
      <p v-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="failed" role="alert" class="grid justify-items-start gap-3 text-sm text-destructive">
        <p>{{ t('detailFailure') }}</p>
        <Button variant="outline" @click="load(true)">{{ t('readLatest') }}</Button>
      </div>
      <template v-else-if="row">
        <p v-if="recorded" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
        <p v-if="reloaded" role="status" class="text-sm text-muted-foreground">{{ t('readDone') }}</p>
        <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <span>{{ t(stateKey[row.status]) }} · {{ t(row.severity === 'OUT' ? 'out' : 'low') }}</span
          ><span class="font-mono text-xs text-muted-foreground">{{ row.code }}</span>
        </div>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt>{{ t('triggerBalance') }}</dt>
          <dd>{{ number(row.availableAtTrigger) }} / {{ number(row.thresholdAtTrigger) }} {{ row.unit }}</dd>
          <dt>{{ t('latestBalance') }}</dt>
          <dd>{{ number(row.availableLatest) }} / {{ number(row.thresholdLatest) }} {{ row.unit }}</dd>
          <dt>{{ t('detected') }}</dt>
          <dd>{{ date(row.detectedAt) }}</dd>
          <dt>{{ t('updated') }}</dt>
          <dd>{{ date(row.updatedAt) }}</dd>
          <template v-if="row.acknowledgedAt"
            ><dt>{{ t('acknowledgedAt') }}</dt>
            <dd>{{ date(row.acknowledgedAt) }}</dd>
            <dt>{{ t('acknowledgedBy') }}</dt>
            <dd>{{ row.acknowledgedBy }}</dd>
            <dt>{{ t('lastNote') }}</dt>
            <dd class="whitespace-pre-wrap">{{ row.note }}</dd></template
          >
          <template v-if="row.resolvedAt"
            ><dt>{{ t('resolvedAt') }}</dt>
            <dd>{{ date(row.resolvedAt) }}</dd>
            <dt>{{ lt('resolution') }}</dt>
            <dd>
              {{ row.resolutionReason === 'ARCHIVED' ? lt('archivedResolution') : lt('recoveredResolution') }}
            </dd></template
          >
        </dl>
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" :disabled="busy" @click="load(true)">{{ t('readLatest') }}</Button
          ><Button variant="outline" :disabled="busy" @click="stock">{{ t('viewStock') }}</Button
          ><Button v-if="row.status !== 'RESOLVED'" variant="outline" :disabled="busy" @click="replenish">{{
            t('viewReplenishment')
          }}</Button>
        </div>
        <form v-if="row.status === 'OPEN'" class="grid gap-3 border-t pt-4" @submit.prevent="acknowledge">
          <label
            >{{ t('note')
            }}<textarea
              v-model="note"
              required
              maxlength="240"
              rows="3"
              :placeholder="t('noteHint')"
              :disabled="busy"
            />
          </label>
          <p class="text-xs leading-5 text-muted-foreground">{{ t('acknowledgeHint') }}</p>
          <p v-if="formError" role="alert" class="text-sm text-destructive">{{ t(formError) }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" :disabled="saving" @click="close">{{
              t('cancel')
            }}</Button
            ><Button type="submit" :disabled="busy || stale || !note.trim()">{{
              t(saving ? 'saving' : 'acknowledge')
            }}</Button>
          </div>
        </form>
        <div v-else-if="note" class="grid gap-2 border-t pt-4">
          <label>{{ t('retained') }}<textarea :value="note" readonly rows="3" /></label>
          <p class="text-xs leading-5 text-muted-foreground">{{ t('retainedHint') }}</p>
        </div>
        <p class="text-xs leading-5 text-muted-foreground">{{ t('escalation') }}</p>
      </template>
      <Button
        v-if="failed || !row || row.status !== 'OPEN'"
        variant="outline"
        class="justify-self-end"
        :disabled="saving"
        @click="close"
        >{{ t('close') }}</Button
      >
    </DialogContent></Dialog
  >
</template>
<style scoped>
label {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--ld-text-muted);
}
textarea {
  min-width: 0;
  width: 100%;
  border: 1px solid var(--ld-border-default);
  border-radius: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: var(--ld-bg-elevated);
  color: var(--ld-text-heading);
  font-size: 0.875rem;
}
textarea:focus-visible {
  outline: 2px solid var(--ld-color-primary);
  outline-offset: 2px;
}
dt {
  color: var(--ld-text-muted);
}
dd {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
