<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { InventoryDailyTrend, InventoryTrendDay, InventoryTrendFilter } from '@lingdian/contracts'
import type { ActivityState } from '../activity-state'
import { Button } from '@/baseComponents/button'
import { inventoryDailyTrend } from '@/services/inventory'
import { useLocale } from '@/i18n/locale'
import { downloadCsv } from '../report'
import TrendChart from './TrendChart.vue'
import TrendDays from './TrendDays.vue'
import { useTrendLocale, type TrendKey } from './locale'
import { parseTrendView, selectionTarget, trendHistoryTarget, trendTarget, zonedDate } from './state'
import { selectedDay, validateTrend } from './model'
import { trendCsvRows } from './export'
const props = defineProps<{ storeId: string; storeName: string; state: ActivityState }>()
const route = useRoute(),
  router = useRouter(),
  { locale } = useLocale(),
  { t, number } = useTrendLocale()
const view = computed(() => parseTrendView(route.query)),
  sourceKey = computed(() =>
    JSON.stringify([
      props.storeId,
      props.state.itemId,
      props.state.startAt,
      props.state.endAt,
      view.value.timeZone,
    ]),
  )
const data = ref<InventoryDailyTrend>(),
  loading = ref(true),
  failed = ref(false),
  error = ref<TrendKey>('failed'),
  from = ref(''),
  to = ref(''),
  timeZone = ref(view.value.timeZone),
  filtersOpen = ref(false),
  region = ref<HTMLElement>()
const date = (value: string, timeZone = view.value.timeZone) =>
  new Intl.DateTimeFormat(locale.value, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
const endDay = (end: string, zone: string) => zonedDate(new Date(Date.parse(end) - 1).toISOString(), zone)
const dirty = computed(
  () =>
    timeZone.value !== view.value.timeZone ||
    from.value !== zonedDate(props.state.startAt, timeZone.value) ||
    to.value !== endDay(props.state.endAt, timeZone.value),
)
const zones = computed(() => {
  const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf
  return [
    ...new Set([
      'UTC',
      timeZone.value,
      ...(supported?.('timeZone') ?? ['Asia/Shanghai', 'Asia/Tokyo', 'America/New_York', 'Europe/London']),
    ]),
  ].sort()
})
const selected = computed(() => (data.value ? selectedDay(data.value.days, view.value.day) : 0)),
  current = computed(() => data.value?.days[selected.value]),
  pages = computed(() => Math.max(1, Math.ceil((data.value?.days.length ?? 0) / 20))),
  page = computed(() => Math.min(view.value.page, pages.value)),
  rows = computed(() => data.value?.days.slice((page.value - 1) * 20, page.value * 20) ?? [])
let sequence = 0,
  cacheKey = '',
  disposed = false
function resetDraft() {
  timeZone.value = view.value.timeZone
  from.value = zonedDate(props.state.startAt, timeZone.value)
  to.value = endDay(props.state.endAt, timeZone.value)
}
watch(timeZone, (zone, previous) => {
  if (
    from.value === zonedDate(props.state.startAt, previous) &&
    to.value === endDay(props.state.endAt, previous)
  ) {
    from.value = zonedDate(props.state.startAt, zone)
    to.value = endDay(props.state.endAt, zone)
  }
})
function failure(e: unknown): TrendKey {
  const message = e instanceof Error ? e.message : ''
  return message === 'inventory.invalidTimeZone'
    ? 'invalidZone'
    : message === 'inventory.invalidPeriod'
      ? 'invalid'
      : message === 'inventory.trendOverflow'
        ? 'overflow'
        : message === 'inventory.trendUnavailable'
          ? 'unavailable'
          : 'failed'
}
async function request(filter: InventoryTrendFilter) {
  const result = validateTrend(
    await inventoryDailyTrend(props.storeId, props.state.itemId, filter),
    props.storeId,
    props.state.itemId,
  )
  if (
    'startAt' in filter &&
    (Date.parse(result.startAt) !== Date.parse(filter.startAt!) ||
      Date.parse(result.endAt) !== Date.parse(filter.endAt!))
  )
    throw Error('unexpected trend range')
  return result
}
async function load() {
  if (!props.state.itemId) {
    loading.value = false
    return
  }
  const token = ++sequence
  loading.value = true
  failed.value = false
  try {
    const result = await request({
      startAt: props.state.startAt,
      endAt: props.state.endAt,
      timeZone: view.value.timeZone,
    })
    if (token === sequence) {
      data.value = result
      cacheKey = sourceKey.value
    }
  } catch (e) {
    if (token === sequence) {
      failed.value = true
      error.value = failure(e)
    }
  } finally {
    if (token === sequence) loading.value = false
  }
}
watch(
  sourceKey,
  () => {
    sequence++
    resetDraft()
    if (cacheKey === sourceKey.value && data.value) {
      loading.value = false
      failed.value = false
    } else {
      data.value = undefined
      void load()
    }
  },
  { immediate: true },
)
watch(
  [() => route.query.trendDay, () => route.query.trendPage, () => data.value, () => loading.value],
  () => {
    if (!data.value || loading.value || failed.value || cacheKey !== sourceKey.value) return
    const day =
      view.value.day && data.value.days.some((day) => day.date === view.value.day) ? view.value.day : ''
    if (view.value.day !== day || view.value.page !== page.value)
      void router.replace({ query: selectionTarget(route.query, { ...view.value, day, page: page.value }) })
  },
)
async function apply() {
  if (loading.value || !props.state.itemId) return
  const token = ++sequence
  loading.value = true
  failed.value = false
  try {
    const unchanged =
      from.value === zonedDate(props.state.startAt, timeZone.value) &&
      to.value === endDay(props.state.endAt, timeZone.value)
    const filter: InventoryTrendFilter = unchanged
      ? { startAt: props.state.startAt, endAt: props.state.endAt, timeZone: timeZone.value }
      : { fromDate: from.value, toDate: to.value, timeZone: timeZone.value }
    const result = await request(filter)
    if (token !== sequence || disposed) return
    const next = {
        ...props.state,
        startAt: result.startAt,
        endAt: result.endAt,
        keyword: '',
        kind: '' as const,
        page: 1,
      },
      target = trendTarget(route.query, next, next.itemId, { timeZone: result.timeZone, day: '', page: 1 })
    cacheKey = JSON.stringify([props.storeId, next.itemId, next.startAt, next.endAt, result.timeZone])
    data.value = result
    filtersOpen.value = false
    await router.push({ query: target })
    await nextTick()
    region.value?.scrollIntoView({ block: 'nearest' })
  } catch (e) {
    if (token === sequence) {
      failed.value = true
      error.value = failure(e)
    }
  } finally {
    if (token === sequence) loading.value = false
  }
}
function choose(index: number) {
  if (loading.value || failed.value || dirty.value || !data.value) return
  const selected = data.value.days[index]
  if (selected)
    void router.replace({
      query: selectionTarget(route.query, {
        ...view.value,
        day: selected.date,
        page: Math.floor(index / 20) + 1,
      }),
    })
}
function inspect(day: InventoryTrendDay) {
  if (data.value) choose(data.value.days.findIndex((value) => value.date === day.date))
}
function history(day: InventoryTrendDay) {
  if (!loading.value && !failed.value && !dirty.value && day.state === 'RECORDED' && day.movementCount)
    void router.push({ query: trendHistoryTarget(route.query, props.state, view.value, day) })
}
function go(value: number) {
  void router.push({ query: selectionTarget(route.query, { ...view.value, page: value }) })
}
function exportData() {
  if (data.value && !loading.value && !failed.value && !dirty.value)
    downloadCsv(
      `inventory-daily-${data.value.startAt.slice(0, 10)}.csv`,
      trendCsvRows(data.value, props.storeName, t),
    )
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <section ref="region" class="grid min-w-0 gap-4 p-4" :aria-label="t('title')">
    <p v-if="!state.itemId" class="text-sm text-muted-foreground">{{ t('choose') }}</p>
    <template v-else>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="break-words text-sm font-semibold">{{ data?.item.name ?? t('title') }}</h2>
          <p v-if="data && !failed" class="mt-1 text-xs text-muted-foreground">
            {{ data.item.code }} · {{ data.item.unit }}
          </p>
          <p class="mt-1 break-words text-xs text-muted-foreground">
            {{ zonedDate(state.startAt, view.timeZone) }} → {{ endDay(state.endAt, view.timeZone) }} ·
            {{ view.timeZone }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            :aria-expanded="filtersOpen"
            @click="filtersOpen = !filtersOpen"
            >{{ t(filtersOpen ? 'hideFilters' : 'filters') }}</Button
          ><Button size="sm" variant="ghost" :disabled="loading || dirty" @click="load">{{
            t('refresh')
          }}</Button
          ><Button
            size="sm"
            variant="outline"
            :disabled="loading || failed || dirty || !data"
            @click="exportData"
            >{{ t('export') }}</Button
          >
        </div>
      </div>
      <form
        v-if="filtersOpen"
        class="flex flex-wrap items-end gap-3 rounded-md border p-3"
        @submit.prevent="apply"
      >
        <label>{{ t('from') }}<input v-model="from" type="date" required /></label
        ><label>{{ t('to') }}<input v-model="to" type="date" required :min="from" /></label
        ><label class="min-w-0 grow"
          >{{ t('zone')
          }}<select v-model="timeZone" :aria-label="t('zone')" class="max-w-full" :disabled="loading">
            <option v-for="zone in zones" :key="zone" :value="zone">{{ zone }}</option>
          </select></label
        ><Button type="submit" :disabled="loading">{{ t('apply') }}</Button
        ><Button type="button" variant="ghost" :disabled="loading" @click="resetDraft">{{
          t('reset')
        }}</Button>
      </form>
      <p v-if="dirty" role="status" class="text-xs text-amber-800">{{ t('dirty') }}</p>
      <p v-if="loading" role="status" class="py-8 text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div
        v-else-if="failed"
        role="alert"
        class="grid justify-items-start gap-3 py-6 text-sm text-destructive"
      >
        <p>{{ t(error) }}</p>
        <Button variant="outline" @click="dirty ? apply() : load()">{{ t('retry') }}</Button>
      </div>
      <template v-else-if="data">
        <TrendChart
          :days="data.days"
          :unit="data.item.unit"
          :selected="selected"
          :disabled="dirty"
          @select="choose"
        />
        <div v-if="current" class="grid gap-3 rounded-md border p-3 text-sm" aria-live="polite">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <strong>{{ t('selected') }} · {{ current.date }}</strong
            ><span class="text-xs text-muted-foreground">{{
              t(current.state === 'RECORDED' ? (current.partial ? 'partial' : 'full') : current.state)
            }}</span>
          </div>
          <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              v-for="key in ['closing', 'availableClosing', 'reservedClosing', 'movementCount'] as const"
              :key="key"
            >
              <dt class="text-xs text-muted-foreground">{{ t(key) }}</dt>
              <dd class="mt-1 break-words tabular-nums">
                {{
                  current.state === 'RECORDED'
                    ? number(current[key]) + (key === 'movementCount' ? '' : ' ' + data.item.unit)
                    : '—'
                }}
              </dd>
            </div>
          </dl>
          <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span v-for="key in ['received', 'issued', 'lost', 'countGain', 'countLoss'] as const" :key="key"
              >{{ t(key) }}: {{ current.state === 'RECORDED' ? number(current[key]) : '—' }}</span
            >
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs text-muted-foreground"
              >{{ date(current.startAt) }} → {{ date(current.endAt) }}</span
            ><Button
              size="sm"
              variant="outline"
              :disabled="dirty || current.state !== 'RECORDED' || !current.movementCount"
              @click="history(current)"
              >{{ t('history') }}</Button
            >
          </div>
        </div>
        <p v-if="data.summary.closing === null" class="text-sm text-muted-foreground">{{ t('noData') }}</p>
        <p class="text-xs text-muted-foreground">{{ t('asOf') }}: {{ date(data.asOfAt) }}</p>
        <details class="text-xs leading-5 text-muted-foreground">
          <summary class="cursor-pointer">{{ t('coverage') }}</summary>
          <p class="mt-2">{{ t('context') }}</p>
          <p class="mt-2">{{ t('period') }}: {{ data.startAt }} → {{ data.endAt }}</p>
          <p class="mt-2">{{ t('exportHint') }}</p>
        </details>
        <h3 class="text-sm font-semibold">{{ t('table') }}</h3>
        <TrendDays
          :days="rows"
          :unit="data.item.unit"
          :selected-date="current?.date ?? ''"
          :disabled="dirty"
          @select="inspect"
          @history="history"
        />
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{{ data.days.length }} {{ t('records') }} · {{ t('page') }} {{ page }} / {{ pages }}</span>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" :disabled="dirty || page <= 1" @click="go(page - 1)">{{
              t('previous')
            }}</Button
            ><Button size="sm" variant="outline" :disabled="dirty || page >= pages" @click="go(page + 1)">{{
              t('next')
            }}</Button>
          </div>
        </div>
      </template>
    </template>
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
input,
select {
  min-width: 0;
  max-width: 100%;
  min-height: 2.25rem;
  border: 1px solid var(--ld-border-default);
  border-radius: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: var(--ld-bg-elevated);
  color: var(--ld-text-heading);
  font-size: 0.875rem;
}
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ld-color-primary);
  outline-offset: 2px;
}
</style>
