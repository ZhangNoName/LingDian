<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { InventoryMovementKind, InventoryPeriodReport } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { SelectField } from '@lingdian/console-ui/select'
import { Table } from '@lingdian/console-ui/table'
import { inventoryNavigationContext } from '../materials/state'
import { activityQuery, type ActivityState } from '../activity-state'
import { downloadCsv } from '../report'
import { analyzeRows, filterAnalysis, type AnalysisOrder, type AnalysisSubset } from './model'
import { analysisQuery, parseAnalysisState } from './state'
import MaterialAnalysis from './MaterialAnalysis.vue'
import { trendTarget } from '../trend/state'
import { useAnalysisLocale } from './locale'
const props = defineProps<{
    report: InventoryPeriodReport
    state: ActivityState
    storeName: string
    dirty: boolean
  }>(),
  route = useRoute(),
  router = useRouter(),
  { t, number, percent } = useAnalysisLocale()
const root = ref<HTMLElement>()
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const state = computed(() => parseAnalysisState(route.query)),
  derived = computed(() => {
    try {
      return { rows: analyzeRows(props.report.rows), failed: false }
    } catch {
      return { rows: [], failed: true }
    }
  }),
  all = computed(() => derived.value.rows),
  rows = computed(() => filterAnalysis(all.value, state.value.subset, state.value.order)),
  pages = computed(() => Math.max(1, Math.ceil(rows.value.length / 20))),
  visible = computed(() => rows.value.slice((props.state.page - 1) * 20, props.state.page * 20)),
  selected = computed(() => rows.value.find((row) => row.itemId === state.value.itemId))
const subset = computed({
    get: () => state.value.subset,
    set: (subset: AnalysisSubset) => {
      void navigate({ ...state.value, subset, itemId: '' }, 1)
    },
  }),
  order = computed({
    get: () => state.value.order,
    set: (order: AnalysisOrder) => {
      void navigate({ ...state.value, order, itemId: '' }, 1)
    },
  })
const metrics = computed(() => [
  { label: 'total' as const, value: all.value.length },
  { label: 'lossMaterials' as const, value: all.value.filter((row) => row.lost > 0).length },
  {
    label: 'countMaterials' as const,
    value: all.value.filter((row) => row.countGain > 0 || row.countLoss > 0).length,
  },
])
function navigate(next = state.value, page = props.state.page, replace = false) {
  const target = {
    query: {
      view: 'report',
      ...inventoryNavigationContext(route.query),
      ...activityQuery({ ...props.state, page }),
      ...analysisQuery(next),
    },
  }
  return replace ? router.replace(target) : router.push(target)
}
watch(
  () => [props.report, state.value.subset, state.value.order, props.state.page],
  () => {
    if (!derived.value.failed && props.state.page > pages.value) void navigate(state.value, pages.value, true)
  },
  { immediate: true },
)
async function focus(itemId: string) {
  const previous = state.value.itemId
  await navigate({ ...state.value, itemId })
  if (!itemId) {
    await nextTick()
    const button = Array.from(
      root.value?.querySelectorAll<HTMLButtonElement>('button[data-analysis-item]') ?? [],
    ).find((button) => button.dataset.analysisItem === previous && button.offsetParent !== null)
    ;(button ?? root.value?.querySelector<HTMLSelectElement>('select'))?.focus()
  }
}
function history(kind: InventoryMovementKind) {
  if (selected.value)
    void router.push({
      query: {
        view: 'history',
        ...inventoryNavigationContext(route.query),
        ...activityQuery({ ...props.state, itemId: selected.value.itemId, kind, page: 1 }),
      },
    })
}
function trend() {
  if (selected.value && !props.dirty)
    void router.push({ query: trendTarget(route.query, props.state, selected.value.itemId) })
}
function exportSnapshot() {
  if (props.dirty || derived.value.failed || !rows.value.length) return
  const data: (string | number)[][] = [
    [t('store'), props.storeName, props.report.storeId],
    [t('period'), props.report.startAt, props.report.endAt],
    [t('timeZone'), timeZone],
    [t('generated'), props.report.generatedAt],
    [t('keyword'), props.state.keyword],
    [t('material'), props.state.itemId || t('ALL')],
    [t('filter'), t(state.value.subset)],
    [t('order'), t(state.value.order)],
    [t('rateHint')],
    [t('countHint')],
    [t('exportHint')],
    [
      t('code'),
      t('material'),
      t('unit'),
      t('opening'),
      t('received'),
      t('issued'),
      t('lost'),
      t('outflow'),
      t('lossRate') + ' (%)',
      t('countGain'),
      t('countLoss'),
      t('countDifference'),
      t('closing'),
      t('movementCount'),
    ],
  ]
  for (const row of rows.value)
    data.push([
      row.code,
      row.name,
      row.unit,
      row.opening,
      row.received,
      row.issued,
      row.lost,
      row.outflow,
      row.lossRate === null ? '' : row.lossRate * 100,
      row.countGain,
      row.countLoss,
      row.countDifference,
      row.closing,
      row.movementCount,
    ])
  downloadCsv(
    `inventory-analysis-${props.report.startAt.slice(0, 10)}-${props.report.endAt.slice(0, 10)}.csv`,
    data,
  )
}
</script>
<template>
  <section ref="root" class="grid min-w-0 gap-4 p-4" :aria-label="t('title')">
    <p class="text-xs leading-5 text-muted-foreground">{{ t('hint') }}</p>
    <p v-if="derived.failed" role="alert" class="text-sm text-destructive">{{ t('tooLarge') }}</p>
    <template v-else>
      <dl class="grid grid-cols-3 gap-3">
        <div v-for="metric in metrics" :key="metric.label" class="min-w-0 border-l-2 pl-3">
          <dt class="text-xs text-muted-foreground">{{ t(metric.label) }}</dt>
          <dd class="mt-2 text-xl font-semibold tabular-nums">{{ number(metric.value) }}</dd>
        </div>
      </dl>
      <p class="text-xs text-muted-foreground">{{ t('summaryHint') }}</p>
      <div class="flex flex-wrap items-end gap-3">
        <label class="grid min-w-0 gap-1 text-xs text-muted-foreground"
          >{{ t('filter')
          }}<SelectField
            v-model="subset"
            :disabled="dirty"
            :aria-label="t('filter')"
            :options="(['ALL', 'LOSS', 'COUNT'] as const).map((value) => ({ value, label: t(value) }))"
          /></label
        ><label class="grid min-w-0 gap-1 text-xs text-muted-foreground"
          >{{ t('order')
          }}<SelectField
            v-model="order"
            :disabled="dirty"
            :aria-label="t('order')"
            :options="[
              { value: 'CODE', label: t('CODE') },
              { value: 'LOSS_RATE', label: t('LOSS_RATE') },
            ]"
          /></label
        ><Button
          size="sm"
          variant="outline"
          class="sm:ml-auto"
          :disabled="dirty || !rows.length"
          @click="exportSnapshot"
          >{{ t('export') }}</Button
        >
      </div>
      <details class="text-xs leading-5 text-muted-foreground">
        <summary class="cursor-pointer">{{ t('rules') }}</summary>
        <p class="mt-2 break-all">
          {{ t('period') }}: {{ report.startAt }} → {{ report.endAt }} · {{ t('timeZone') }}: {{ timeZone }}
        </p>
        <p class="mt-2">{{ t('rateHint') }}</p>
        <p class="mt-2">{{ t('countHint') }}</p>
        <p class="mt-2">{{ t('exportHint') }}</p>
      </details>
      <MaterialAnalysis
        v-if="selected"
        :row="selected"
        :disabled="dirty"
        @clear="focus('')"
        @history="history"
        @trend="trend"
      />
      <div
        v-else-if="state.itemId"
        role="status"
        class="grid justify-items-start gap-2 rounded-md border p-3 text-sm"
      >
        <p>{{ t('unavailable') }}</p>
        <Button size="sm" variant="ghost" :disabled="dirty" @click="focus('')">{{ t('clear') }}</Button>
      </div>
      <p v-if="!rows.length" class="py-6 text-center text-sm text-muted-foreground">{{ t('empty') }}</p>
      <template v-else>
        <Table container-class="hidden md:block" tabindex="0" :aria-label="t('title')" class="border-collapse text-left">
          <thead>
            <tr>
              <th scope="col">{{ t('material') }}</th>
              <th scope="col">{{ t('outflow') }}</th>
              <th scope="col">{{ t('lost') }}</th>
              <th scope="col">{{ t('lossRate') }}</th>
              <th scope="col">{{ t('countGain') }}</th>
              <th scope="col">{{ t('countLoss') }}</th>
              <th scope="col">{{ t('countDifference') }}</th>
              <th scope="col">{{ t('actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visible"
              :key="row.itemId"
              :class="{ 'bg-muted/40': row.itemId === state.itemId }"
            >
              <th scope="row" class="max-w-60 font-medium">
                <span class="break-words">{{ row.name }}</span
                ><span class="mt-1 block break-all text-xs font-normal text-muted-foreground"
                  >{{ row.code }} · {{ row.unit }}</span
                >
              </th>
              <td>{{ number(row.outflow) }} {{ row.unit }}</td>
              <td>{{ number(row.lost) }} {{ row.unit }}</td>
              <td>{{ percent(row.lossRate) }}</td>
              <td>{{ number(row.countGain) }} {{ row.unit }}</td>
              <td>{{ number(row.countLoss) }} {{ row.unit }}</td>
              <td>{{ number(row.countDifference) }} {{ row.unit }}</td>
              <td>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="dirty"
                  :aria-label="`${t('focus')} ${row.name}`"
                  :data-analysis-item="row.itemId"
                  @click="focus(row.itemId)"
                  >{{ t('focus') }}</Button
                >
              </td>
            </tr>
          </tbody>
        </Table>
        <ul class="grid gap-3 md:hidden">
          <li
            v-for="row in visible"
            :key="row.itemId"
            class="grid min-w-0 gap-3 rounded-md border p-3 text-sm"
            :class="{ 'border-primary': row.itemId === state.itemId }"
          >
            <div>
              <strong class="break-words">{{ row.name }}</strong>
              <p class="mt-1 break-all text-xs text-muted-foreground">{{ row.code }} · {{ row.unit }}</p>
            </div>
            <dl class="grid grid-cols-2 gap-3">
              <div v-for="key in ['outflow', 'lost', 'countGain', 'countLoss'] as const" :key="key">
                <dt class="text-xs text-muted-foreground">{{ t(key) }}</dt>
                <dd class="mt-1 break-words tabular-nums">{{ number(row[key]) }} {{ row.unit }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">{{ t('lossRate') }}</dt>
                <dd class="mt-1 break-words tabular-nums">{{ percent(row.lossRate) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">{{ t('countDifference') }}</dt>
                <dd class="mt-1 break-words tabular-nums">
                  {{ number(row.countDifference) }} {{ row.unit }}
                </dd>
              </div>
            </dl>
            <Button
              class="justify-self-end"
              size="sm"
              variant="outline"
              :disabled="dirty"
              :aria-label="`${t('focus')} ${row.name}`"
              :data-analysis-item="row.itemId"
              @click="focus(row.itemId)"
              >{{ t('focus') }}</Button
            >
          </li>
        </ul>
      </template>
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground"
      >
        <span
          >{{ number(rows.length) }} {{ t('records') }} · {{ t('page') }} {{ props.state.page }} /
          {{ pages }}</span
        >
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            :disabled="dirty || props.state.page <= 1"
            @click="navigate(state, props.state.page - 1)"
            >{{ t('previous') }}</Button
          ><Button
            size="sm"
            variant="outline"
            :disabled="dirty || props.state.page >= pages"
            @click="navigate(state, props.state.page + 1)"
            >{{ t('next') }}</Button
          >
        </div>
      </div>
      <p class="text-xs text-muted-foreground">{{ t('snapshot') }}</p>
    </template>
  </section>
</template>
<style scoped>
th,
td {
  border-bottom: 1px solid var(--ld-border-default);
  padding: 0.75rem 0.875rem;
}
thead th {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ld-text-muted);
  white-space: nowrap;
}
td {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
thead th:not(:first-child) {
  text-align: right;
}
</style>
