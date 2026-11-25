<script setup lang="ts">
import { Badge } from '@lingdian/console-ui/badge'
import FilterToggle from '@/components/FilterToggle.vue'
import ListToolbar from '@/components/table/ListToolbar.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import TableAction from '@/components/table/TableAction.vue'
import { ClipboardList, EyeIcon } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { InventoryAlertPage, InventoryAlertRecord } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { Table } from '@lingdian/console-ui/table'
import { useLocale } from '@/i18n/locale'
import { listInventoryAlerts } from '@/services/inventory'
import { useLifecycleLocale } from './lifecycle/locale'
import { downloadCsv } from './report'
import { alertEn, alertZh, type AlertMessageKey } from './alert-messages'
import AlertDetail from './alerts/AlertDetail.vue'
import { alertId, alertTarget, canonicalAlerts, parseAlertState, type AlertState } from './alerts/state'
const props = defineProps<{ storeId: string; storeName: string }>()
const emit = defineEmits<{
  stock: [itemId: string, lifecycle: 'ACTIVE' | 'ARCHIVED']
  replenish: [itemId: string]
}>()
const { locale } = useLocale(),
  { t: lt } = useLifecycleLocale(),
  route = useRoute(),
  router = useRouter()
const resolution = (row: InventoryAlertRecord) =>
  row.resolutionReason === 'ARCHIVED'
    ? lt('archivedResolution')
    : row.status === 'RESOLVED'
      ? lt('recoveredResolution')
      : ''
const t = (key: AlertMessageKey) => (locale.value === 'en-US' ? alertEn : alertZh)[key]
const state = computed(() => parseAlertState(route.query)),
  id = computed(() => alertId(route.query.alertId))
const result = ref<InventoryAlertPage>(),
  keyword = ref(''),
  status = ref<AlertState['status']>('ACTIVE'),
  severity = ref<AlertState['severity']>('')
const loading = ref(true),
  error = ref(false),
  filtersOpen = ref(false)
const filterCount = computed(
  () =>
    Number(state.value.status !== 'ACTIVE') + Number(!!state.value.severity) + Number(!!state.value.keyword),
)
const filterSummary = computed(() =>
  [
    state.value.status !== 'ACTIVE'
      ? t(statuses.find((option) => option.value === state.value.status)?.key ?? 'active')
      : '',
    state.value.severity ? t(state.value.severity === 'OUT' ? 'out' : 'low') : '',
    state.value.keyword,
  ]
    .filter(Boolean)
    .join(' · '),
)
const dirty = computed(
  () =>
    keyword.value.trim() !== state.value.keyword ||
    status.value !== state.value.status ||
    severity.value !== state.value.severity,
)
const statuses = [
  { value: 'ACTIVE', key: 'active' },
  { value: 'OPEN', key: 'open' },
  { value: 'ACKNOWLEDGED', key: 'acknowledged' },
  { value: 'RESOLVED', key: 'resolved' },
  { value: 'ALL', key: 'all' },
] as const
const stateKey = { OPEN: 'open', ACKNOWLEDGED: 'acknowledged', RESOLVED: 'resolved' } as const
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value),
      )
    : '—'
let sequence = 0,
  disposed = false
function navigate(next: AlertState, selected = id.value, replace = false) {
  const target = { query: alertTarget(route.query, next, selected) }
  return replace ? router.replace(target) : router.push(target)
}
async function load() {
  const current = ++sequence,
    snapshot = state.value,
    store = props.storeId
  loading.value = true
  error.value = false
  try {
    const data = await listInventoryAlerts(store, { ...snapshot, severity: snapshot.severity || undefined })
    if (current !== sequence) return
    const last = Math.max(1, Math.ceil(data.total / (snapshot.pageSize ?? 20)))
    if (snapshot.page > last) {
      await navigate({ ...snapshot, page: last }, id.value, true)
      return
    }
    result.value = data
    window.dispatchEvent(
      new CustomEvent('inventory-alerts-changed', { detail: { storeId: store, open: data.summary.open } }),
    )
  } catch {
    if (current === sequence) error.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  [() => props.storeId, () => JSON.stringify(state.value)],
  async () => {
    const token = ++sequence,
      value = state.value
    keyword.value = value.keyword
    status.value = value.status
    severity.value = value.severity
    if (!canonicalAlerts(route.query, value, id.value)) await navigate(value, id.value, true)
    if (!disposed && token === sequence) await load()
  },
  { immediate: true },
)
// Normalise only alert-owned fields. A malformed link cannot select several records.
watch(
  () => route.query.alertId,
  () => {
    if (!canonicalAlerts(route.query, state.value, id.value)) void navigate(state.value, id.value, true)
  },
)
async function apply() {
  filtersOpen.value = false
  const next = { keyword: keyword.value.trim(), status: status.value, severity: severity.value, page: 1, pageSize: state.value.pageSize }
  if (canonicalAlerts(route.query, next, id.value)) await load()
  else await navigate(next)
}
function reset() {
  filtersOpen.value = false
  keyword.value = ''
  status.value = 'ACTIVE'
  severity.value = ''
  const next = { ...parseAlertState({}), pageSize: state.value.pageSize }
  if (canonicalAlerts(route.query, next, '')) void load()
  else void navigate(next, '')
}
function view(row: InventoryAlertRecord) {
  void navigate(state.value, row.id)
}
async function close() {
  await navigate(state.value, '')
  if (!disposed) await load()
}
function stock(itemId: string, lifecycle: 'ACTIVE' | 'ARCHIVED') {
  emit('stock', itemId, lifecycle)
}
function replenish(itemId: string) {
  emit('replenish', itemId)
}
function exportPage() {
  if (!result.value || loading.value || error.value || dirty.value) return
  const rows: (string | number)[][] = [
    [t('store'), props.storeName, props.storeId],
    [t('currentPage'), state.value.page, t('exported'), new Date().toISOString()],
    [
      t('status'),
      t(statuses.find((option) => option.value === state.value.status)?.key ?? 'active'),
      t('search'),
      state.value.keyword,
      t('severity'),
      state.value.severity ? t(state.value.severity === 'OUT' ? 'out' : 'low') : t('allSeverities'),
    ],
    [t('exportScope')],
    [
      t('alertIdentifier'),
      t('materialIdentifier'),
      t('material'),
      t('code'),
      t('unit'),
      t('severity'),
      t('status'),
      t('triggerBalance'),
      t('latestBalance'),
      t('detected'),
      t('acknowledgedAt'),
      t('acknowledgedBy'),
      t('lastNote'),
      t('resolvedAt'),
      lt('resolution'),
    ],
  ]
  for (const row of result.value.items)
    rows.push([
      row.id,
      row.itemId,
      row.name,
      row.code,
      row.unit,
      t(row.severity === 'OUT' ? 'out' : 'low'),
      t(stateKey[row.status]),
      `${row.availableAtTrigger} / ${row.thresholdAtTrigger}`,
      `${row.availableLatest} / ${row.thresholdLatest}`,
      row.detectedAt,
      row.acknowledgedAt ?? '',
      row.acknowledgedBy ?? '',
      row.note ?? '',
      row.resolvedAt ?? '',
      resolution(row),
    ])
  downloadCsv(`inventory-alerts-${new Date().toISOString().slice(0, 10)}-p${state.value.page}.csv`, rows)
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <section class="min-w-0">
    <div class="grid grid-cols-3 gap-3 border-b p-4" :aria-label="t('title')">
      <div
        v-for="metric in [
          { key: 'openCount' as const, value: result?.summary.open },
          { key: 'acknowledgedCount' as const, value: result?.summary.acknowledged },
          { key: 'outCount' as const, value: result?.summary.out },
        ]"
        :key="metric.key"
      >
        <p class="text-xs text-muted-foreground">{{ t(metric.key) }}</p>
        <strong class="mt-1 block text-xl font-semibold tabular-nums">{{
          loading || error ? '—' : number(metric.value ?? 0)
        }}</strong>
      </div>
    </div>
    <form
      id="alert-filters"
      class="flex-wrap items-end gap-3 px-4 pt-4 md:flex"
      :class="filtersOpen ? 'flex' : 'hidden'"
      @submit.prevent="apply"
    >
      <label class="grow sm:grow-0"
        >{{ t('search') }}<Input v-model="keyword" type="search" maxlength="120" /></label
      ><label
        >{{ t('status')
        }}<SelectField
          v-model="status"
          :aria-label="t('status')"
          :disabled="loading"
          :options="statuses.map((option) => ({ value: option.value, label: t(option.key) }))"
        /></label
      ><label
        >{{ t('severity')
        }}<SelectField
          v-model="severity"
          :aria-label="t('severity')"
          :disabled="loading"
          :options="[
            { value: '', label: t('allSeverities') },
            { value: 'OUT', label: t('out') },
            { value: 'LOW', label: t('low') },
          ]"
        /></label>
    </form>
    <ListToolbar class="border-b px-4 py-3">
      <template #left>
        <FilterToggle v-model="filtersOpen" controls="alert-filters" class="md:hidden">
          {{ t(filtersOpen ? 'hideFilters' : 'filters') }}
          <span v-if="filterCount" class="ml-1">({{ filterCount }})</span>
        </FilterToggle>
      </template>
      <DataActionButton
        action="export"
        :label="t('export')"
        :disabled="loading || error || dirty || !result?.total"
        @click="exportPage"
      />
      <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || dirty" @click="load" />
      <Button type="submit" form="alert-filters" variant="outline" :disabled="loading">{{ t('apply') }}</Button>
      <Button type="button" variant="ghost" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
    </ListToolbar>
    <p v-if="filterSummary" class="break-words px-4 pt-2 text-xs text-muted-foreground md:hidden">{{ filterSummary }}</p>
    <p v-if="dirty" role="status" class="border-b px-4 py-2 text-xs text-amber-800">
      {{ t('filterChanged') }}
    </p>
    <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">
      {{ t('loading') }}
    </p>
    <div v-else-if="error" role="alert" class="grid justify-items-start gap-3 p-8 text-sm text-destructive">
      <p>{{ t('failure') }}</p>
      <DataActionButton action="refresh" :label="t('refresh')" @click="load" />
    </div>
    <div v-else-if="!result?.total" class="p-8 text-center text-sm text-muted-foreground">
      <p class="font-medium text-foreground">{{ t('empty') }}</p>
    </div>
    <template v-else>
      <Table framed container-class="mx-4 mt-4 hidden md:block" tabindex="0" :aria-label="t('title')" class="border-collapse text-start">
        <thead>
          <tr>
            <th>{{ t('material') }}</th>
            <th>{{ t('severity') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('balance') }}</th>
            <th>{{ t('detected') }}</th>
            <th>{{ t('followup') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in result?.items" :key="row.id">
            <th scope="row" class="font-medium">
              {{ row.name
              }}<span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{
                row.code
              }}</span>
            </th>
            <td>
              <Badge :variant="row.status === 'RESOLVED' ? 'secondary' : row.severity === 'OUT' ? 'attention' : 'warning'">
                {{ t(row.severity === 'OUT' ? 'out' : 'low') }}
              </Badge>
            </td>
            <td>
              <Badge :variant="row.status === 'RESOLVED' ? 'success' : 'secondary'">{{ t(stateKey[row.status]) }}</Badge>
            </td>
            <td class="font-semibold tabular-nums">
              {{ number(row.availableLatest) }} / {{ number(row.thresholdLatest) }} {{ row.unit }}
            </td>
            <td class="text-xs">{{ date(row.detectedAt) }}</td>
            <td class="min-w-40 max-w-72 whitespace-normal break-words text-muted-foreground">
              {{ row.note ?? '—' }}
            </td>
            <td>
              <TableAction :icon="row.status === 'OPEN' ? ClipboardList : EyeIcon" :label="t(row.status === 'OPEN' ? 'acknowledge' : 'detail')"
                :aria-label="`${t('detail')} ${row.name}`"
                @click="view(row)" />
            </td>
          </tr>
        </tbody>
      </Table>

      <ul class="table-scroll grid gap-3 p-4 md:hidden">
        <li
          v-for="row in result?.items"
          :key="row.id"
          class="grid min-w-0 gap-3 border p-3 text-sm"
        >
          <div class="flex flex-wrap justify-between gap-2">
            <strong class="break-words">{{ row.name }}</strong>
            <Badge :variant="row.status === 'RESOLVED' ? 'success' : row.severity === 'OUT' ? 'attention' : 'warning'">
              {{ t(row.severity === 'OUT' ? 'out' : 'low') }} · {{ t(stateKey[row.status]) }}
            </Badge>
          </div>
          <p class="break-words font-mono text-xs text-muted-foreground">{{ row.code }}</p>
          <p class="tabular-nums">
            {{ t('balance') }}: {{ number(row.availableLatest) }} / {{ number(row.thresholdLatest) }}
            {{ row.unit }}
          </p>
          <p class="text-xs text-muted-foreground">{{ t('detected') }}: {{ date(row.detectedAt) }}</p>
          <p v-if="row.note" class="line-clamp-2 break-words text-muted-foreground">
            {{ t('followup') }}: {{ row.note }}
          </p>
          <TableAction :icon="row.status === 'OPEN' ? ClipboardList : EyeIcon" :label="t(row.status === 'OPEN' ? 'acknowledge' : 'detail')"
            class="justify-self-end"
            :aria-label="`${t('detail')} ${row.name}`"
            @click="view(row)" />
        </li>
      </ul>
    </template>
    <div
      v-if="!loading && !error"
      class="flex flex-wrap justify-between gap-3 border-t p-4 text-sm text-muted-foreground"
    >
      <span
        >{{ number(result?.total ?? 0) }} {{ t('total') }}</span
      >
      <div class="flex gap-2">
        <TablePagination
          :page-size="state.pageSize ?? 20"
          @update:page-size="navigate({ ...state, page: 1, pageSize: $event })"
          :page="state.page"
          :pages="Math.ceil((result?.total ?? 0) / (state.pageSize ?? 20))"
          :disabled="dirty"
          @update:page="navigate({ ...state, page: $event })"
        />
      </div>
    </div>
    <AlertDetail
      v-if="id"
      :key="storeId + ':' + id"
      :store-id="storeId"
      :id="id"
      @close="close"
      @saved="load"
      @stock="stock"
      @replenish="replenish"
    />
  </section>
</template>
<style scoped>
label {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--ld-text-muted);
}
dt {
  color: var(--ld-text-muted);
}
dd {
  overflow-wrap: anywhere;
}
</style>
