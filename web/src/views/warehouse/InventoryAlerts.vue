<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { InventoryAlertPage, InventoryAlertRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { useLocale } from '@/i18n/locale'
import { acknowledgeInventoryAlert, listInventoryAlerts, type AlertQuery } from '@/services/inventory'
import { useLifecycleLocale } from './lifecycle/locale'
import { downloadCsv } from './report'
import { alertEn, alertZh, type AlertMessageKey } from './alert-messages'
const props = defineProps<{ storeId: string; storeName: string }>()
const emit = defineEmits<{ stock: [code: string, lifecycle: 'ACTIVE' | 'ARCHIVED']; replenish: [itemId: string] }>()
const { locale } = useLocale()
const { t: lt } = useLifecycleLocale()
const resolution = (row: InventoryAlertRecord) => row.resolutionReason === 'ARCHIVED' ? lt('archivedResolution') : row.status === 'RESOLVED' ? lt('recoveredResolution') : ''
const t = (key: AlertMessageKey) => (locale.value === 'en-US' ? alertEn : alertZh)[key]
const result = ref<InventoryAlertPage>(), page = ref(1), status = ref<AlertQuery['status']>('ACTIVE'), severity = ref<'' | 'LOW' | 'OUT'>(''), keyword = ref(''), appliedKeyword = ref('')
const loading = ref(true), error = ref(false), selected = ref<InventoryAlertRecord>(), note = ref(''), saving = ref(false), formError = ref<AlertMessageKey>(), saved = ref(false)
const dirty = computed(() => keyword.value.trim() !== appliedKeyword.value)
const statuses = [{ value: 'ACTIVE', key: 'active' }, { value: 'OPEN', key: 'open' }, { value: 'ACKNOWLEDGED', key: 'acknowledged' }, { value: 'RESOLVED', key: 'resolved' }, { value: 'ALL', key: 'all' }] as const
const stateKey = { OPEN: 'open', ACKNOWLEDGED: 'acknowledged', RESOLVED: 'resolved' } as const
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
let sequence = 0
async function load() {
  const current = ++sequence; loading.value = true; error.value = false
  try { const data = await listInventoryAlerts(props.storeId, { page: page.value, status: status.value, severity: severity.value || undefined, keyword: appliedKeyword.value }); if (current === sequence) { result.value = data; window.dispatchEvent(new CustomEvent('inventory-alerts-changed', { detail: { storeId: props.storeId, open: data.summary.open } })) } }
  catch { if (current === sequence) error.value = true }
  finally { if (current === sequence) loading.value = false }
}
function apply() { page.value = 1; appliedKeyword.value = keyword.value.trim(); saved.value = false; void load() }
function view(row: InventoryAlertRecord) { selected.value = row; note.value = ''; formError.value = undefined; saved.value = false }
function showStock() { if (selected.value && !saving.value) { const code = selected.value.code, lifecycle = selected.value.itemIsActive === false ? 'ARCHIVED' : 'ACTIVE'; selected.value = undefined; emit('stock', code, lifecycle) } }
function showReplenishment() { if (selected.value && !saving.value) { const itemId = selected.value.itemId; selected.value = undefined; emit('replenish', itemId) } }
function close(open: boolean) { if (!open && !saving.value) selected.value = undefined }
async function acknowledge() {
  if (!selected.value || saving.value) return
  saving.value = true; formError.value = undefined
  try {
    await acknowledgeInventoryAlert(props.storeId, selected.value.id, { expectedVersion: selected.value.version, note: note.value.trim() })
    selected.value = undefined; saved.value = true; await load()
  } catch (error) { formError.value = error instanceof Error && ['inventory.alertStale', 'inventory.alertNotFound'].includes(error.message) ? 'stale' : 'unexpected' }
  finally { saving.value = false }
}
function exportPage() {
  if (!result.value || loading.value || error.value || dirty.value) return
  const rows: (string | number)[][] = [[t('store'), props.storeName, props.storeId], [t('currentPage'), page.value, t('exported'), new Date().toISOString()], [t('status'), t(statuses.find(option => option.value === status.value)?.key ?? 'active'), t('search'), appliedKeyword.value, t('severity'), severity.value ? t(severity.value === 'OUT' ? 'out' : 'low') : t('allSeverities')], [t('material'), t('code'), t('unit'), t('severity'), t('status'), t('triggerBalance'), t('latestBalance'), t('detected'), t('acknowledgedAt'), t('acknowledgedBy'), t('lastNote'), t('resolvedAt'), lt('resolution')]]
  for (const row of result.value.items) rows.push([row.name, row.code, row.unit, t(row.severity === 'OUT' ? 'out' : 'low'), t(stateKey[row.status]), `${row.availableAtTrigger} / ${row.thresholdAtTrigger}`, `${row.availableLatest} / ${row.thresholdLatest}`, row.detectedAt, row.acknowledgedAt ?? '', row.acknowledgedBy ?? '', row.note ?? '', row.resolvedAt ?? '', resolution(row)])
  downloadCsv(`inventory-alerts-${new Date().toISOString().slice(0, 10)}-p${page.value}.csv`, rows)
}
onMounted(load)
onBeforeUnmount(() => { sequence++ })
</script>
<template>
  <section class="min-w-0">
    <div class="grid grid-cols-3 gap-3 border-b p-4" :aria-label="t('title')">
      <div v-for="metric in [{ key: 'openCount' as const, value: result?.summary.open }, { key: 'acknowledgedCount' as const, value: result?.summary.acknowledged }, { key: 'outCount' as const, value: result?.summary.out }]" :key="metric.key"><p class="text-xs text-muted-foreground">{{ t(metric.key) }}</p><strong class="mt-1 block text-xl font-semibold tabular-nums">{{ loading || error ? '—' : number(metric.value ?? 0) }}</strong></div>
    </div>
    <form class="flex flex-wrap items-end gap-3 border-b p-4" @submit.prevent="apply"><label class="grow sm:grow-0">{{ t('search') }}<input v-model="keyword" type="search" maxlength="120" /></label><label>{{ t('status') }}<select v-model="status" :aria-label="t('status')" :disabled="loading" @change="apply"><option v-for="option in statuses" :key="option.value" :value="option.value">{{ t(option.key) }}</option></select></label><label>{{ t('severity') }}<select v-model="severity" :aria-label="t('severity')" :disabled="loading" @change="apply"><option value="">{{ t('allSeverities') }}</option><option value="OUT">{{ t('out') }}</option><option value="LOW">{{ t('low') }}</option></select></label><Button type="submit" variant="outline" :disabled="loading">{{ t('apply') }}</Button><Button type="button" variant="ghost" :disabled="loading || dirty" @click="load">{{ t('refresh') }}</Button><Button type="button" variant="outline" class="sm:ml-auto" :disabled="loading || error || dirty || !result?.total" @click="exportPage">{{ t('export') }}</Button></form>
    <p v-if="dirty" role="status" class="border-b px-4 py-2 text-xs text-amber-800">{{ t('filterChanged') }}</p>
    <p class="border-b px-4 py-3 text-xs text-muted-foreground">{{ t('hint') }}</p>
    <p v-if="saved" role="status" class="px-4 pt-3 text-sm text-emerald-700">{{ t('saved') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert" class="grid justify-items-start gap-3 p-8 text-sm text-destructive"><p>{{ t('failure') }}</p><Button variant="outline" @click="load">{{ t('refresh') }}</Button></div>
    <div v-else-if="!result?.total" class="p-8 text-center text-sm text-muted-foreground"><p class="font-medium text-foreground">{{ t('empty') }}</p><p class="mt-2">{{ t('emptyHint') }}</p></div>
    <div v-else class="overflow-x-auto" tabindex="0" :aria-label="t('title')"><table><thead><tr><th>{{ t('material') }}</th><th>{{ t('severity') }}</th><th>{{ t('status') }}</th><th>{{ t('balance') }}</th><th>{{ t('detected') }}</th><th>{{ t('followup') }}</th><th></th></tr></thead><tbody><tr v-for="row in result?.items" :key="row.id"><th scope="row" class="font-medium">{{ row.name }}<span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{ row.code }}</span></th><td><span :class="row.status === 'RESOLVED' ? 'text-muted-foreground' : row.severity === 'OUT' ? 'text-red-700' : 'text-amber-800'">{{ t(row.severity === 'OUT' ? 'out' : 'low') }}</span></td><td>{{ t(stateKey[row.status]) }}</td><td class="tabular-nums">{{ number(row.availableLatest) }} / {{ number(row.thresholdLatest) }} {{ row.unit }}</td><td class="text-xs">{{ date(row.detectedAt) }}</td><td class="min-w-40 max-w-72 whitespace-normal break-words text-muted-foreground">{{ row.note ?? '—' }}</td><td><Button size="sm" variant="outline" :aria-label="`${t('detail')} ${row.name}`" @click="view(row)">{{ t(row.status === 'OPEN' ? 'acknowledge' : 'detail') }}</Button></td></tr></tbody></table></div>
    <div v-if="!loading && !error" class="flex justify-between gap-3 border-t p-4 text-sm text-muted-foreground"><span>{{ result?.total ?? 0 }} {{ t('total') }} · {{ t('page') }} {{ page }}</span><div class="flex gap-2"><Button size="sm" variant="outline" :disabled="dirty || page <= 1" @click="page--; load()">{{ t('previous') }}</Button><Button size="sm" variant="outline" :disabled="dirty || page * 20 >= (result?.total ?? 0)" @click="page++; load()">{{ t('next') }}</Button></div></div>
    <Dialog :open="!!selected" @update:open="close"><DialogContent class="max-h-[90dvh] max-w-xl overflow-y-auto" :close-label="t('close')"><DialogHeader><DialogTitle>{{ selected?.name }} · {{ t('title') }}</DialogTitle><DialogDescription>{{ t(selected?.status === 'OPEN' ? 'acknowledgeHint' : 'snapshot') }}</DialogDescription></DialogHeader>
      <dl v-if="selected" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm"><dt>{{ t('status') }}</dt><dd>{{ t(stateKey[selected.status]) }}</dd><dt>{{ t('lastSeverity') }}</dt><dd>{{ t(selected.severity === 'OUT' ? 'out' : 'low') }}</dd><dt>{{ t('triggerBalance') }}</dt><dd>{{ number(selected.availableAtTrigger) }} / {{ number(selected.thresholdAtTrigger) }} {{ selected.unit }}</dd><dt>{{ t('latestBalance') }}</dt><dd>{{ number(selected.availableLatest) }} / {{ number(selected.thresholdLatest) }} {{ selected.unit }}</dd><dt>{{ t('detected') }}</dt><dd>{{ date(selected.detectedAt) }}</dd><dt>{{ t('updated') }}</dt><dd>{{ date(selected.updatedAt) }}</dd><template v-if="selected.acknowledgedAt"><dt>{{ t('acknowledgedAt') }}</dt><dd>{{ date(selected.acknowledgedAt) }}</dd><dt>{{ t('acknowledgedBy') }}</dt><dd class="break-all">{{ selected.acknowledgedBy }}</dd><dt>{{ t('lastNote') }}</dt><dd class="whitespace-pre-wrap break-words">{{ selected.note }}</dd></template><template v-if="selected.resolvedAt"><dt>{{ t('resolvedAt') }}</dt><dd>{{ date(selected.resolvedAt) }}</dd><dt>{{lt('resolution')}}</dt><dd>{{resolution(selected)}}</dd></template></dl>
      <div class="flex flex-wrap items-center justify-between gap-3"><p class="min-w-0 flex-1 text-xs text-muted-foreground">{{ t('escalation') }}</p><Button type="button" variant="outline" :disabled="saving" @click="showStock">{{ t('viewStock') }}</Button><Button v-if="selected?.status !== 'RESOLVED'" type="button" variant="outline" :disabled="saving" @click="showReplenishment">{{ t('viewReplenishment') }}</Button></div>
      <form v-if="selected?.status === 'OPEN'" class="grid gap-4 border-t pt-4" @submit.prevent="acknowledge"><label>{{ t('note') }}<textarea v-model="note" required minlength="1" maxlength="240" rows="3" :placeholder="t('noteHint')" :disabled="saving" /></label><p v-if="formError" role="alert" class="text-sm text-destructive">{{ t(formError) }}</p><div class="flex justify-end gap-2"><Button type="button" variant="outline" :disabled="saving" @click="close(false)">{{ t('cancel') }}</Button><Button :disabled="saving || !note.trim()">{{ t(saving ? 'saving' : 'acknowledge') }}</Button></div></form>
      <Button v-else variant="outline" class="justify-self-end" @click="close(false)">{{ t('close') }}</Button>
    </DialogContent></Dialog>
  </section>
</template>
<style scoped>
label { display: grid; min-width: 0; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
input, select, textarea { min-width: 0; max-width: 100%; min-height: 2.25rem; border: 1px solid var(--ld-border-default); border-radius: .375rem; padding: .5rem .625rem; background: var(--ld-bg-elevated); color: var(--ld-text-heading); font-size: .875rem; }
input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--ld-color-primary); outline-offset: 2px; }
table { width: 100%; border-collapse: collapse; text-align: start; font-size: .875rem; }
th, td { padding: .875rem 1rem; border-bottom: 1px solid var(--ld-border-default); white-space: nowrap; }
thead th { font-size: .75rem; font-weight: 500; color: var(--ld-text-muted); }
dt { color: var(--ld-text-muted); } dd { overflow-wrap: anywhere; }
</style>
