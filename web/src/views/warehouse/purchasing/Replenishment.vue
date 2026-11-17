<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ReplenishmentSnapshot, ReplenishmentRow } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { replenishmentSnapshot } from '@/services/purchasing'
import { downloadCsv } from '../report'
import AnalysisTable from './AnalysisTable.vue'
import { errorKey, usePurchasingLocale, type Key } from './locale'
const props = defineProps<{ storeId: string; storeName: string }>(),
  emit = defineEmits<{ create: [ReplenishmentRow] }>(),
  route = useRoute(),
  router = useRouter(),
  { t, number, date } = usePurchasingLocale()
const applied = computed(() =>
    typeof route.query.replenishmentKeyword === 'string' ? route.query.replenishmentKeyword.trim().slice(0, 120) : '',
  ),
  keyword = ref(''),
  subset = ref('NEEDED'),
  snapshot = ref<ReplenishmentSnapshot>(),
  loading = ref(true),
  error = ref<Key>(),
  filtersOpen = ref(false),
  page = ref(1)
const dirty = computed(() => keyword.value.trim() !== applied.value),
  rows = computed(() =>
    (snapshot.value?.rows ?? [])
      .filter(
        (row) =>
          subset.value === 'ALL' ||
          (subset.value === 'NEEDED' ? row.recommendedQuantity > 0 : row.shortage > 0 && row.recommendedQuantity === 0),
      )
      .sort((a, b) => b.recommendedQuantity - a.recommendedQuantity || a.code.localeCompare(b.code)),
  ),
  pages = computed(() => Math.max(1, Math.ceil(rows.value.length / 20)))
const display = computed(() =>
  rows.value.slice((page.value - 1) * 20, page.value * 20).map((row) => ({
    key: row.id,
    title: row.name,
    subtitle: `${row.code} · ${t('available')} ${number(row.availableQuantity ?? row.quantity)} / ${t('threshold')} ${number(row.reorderPoint)} ${row.unit} · ${t('onOrderCount')} ${row.pendingOrderCount}`,
    quantity: `${number(row.recommendedQuantity)} ${row.unit}`,
    value: `${number(row.pendingQuantity)} ${row.unit}`,
    action: row.id,
    actionLabel: t('createFromPlan'),
    disabled: row.recommendedQuantity <= 0,
  })),
)
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  error.value = undefined
  page.value = 1
  try {
    const result = await replenishmentSnapshot(props.storeId, { keyword: applied.value })
    if (current === sequence) snapshot.value = result
  } catch (e) {
    if (current === sequence) error.value = errorKey(e) === 'saveFailed' ? 'failed' : errorKey(e)
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => [props.storeId, applied.value],
  () => {
    keyword.value = applied.value
    void load()
  },
  { immediate: true },
)
watch(subset, () => {
  page.value = 1
})
async function apply() {
  if (keyword.value.trim() === applied.value) await load()
  else await router.push({ query: { ...route.query, replenishmentKeyword: keyword.value.trim() || undefined } })
}
function create(id: string) {
  const row = snapshot.value?.rows.find((row) => row.id === id)
  if (row && row.recommendedQuantity > 0) emit('create', row)
}
function exportSnapshot() {
  if (!snapshot.value || loading.value || error.value || dirty.value) return
  const data: (string | number)[][] = [
    [props.storeName, props.storeId],
    [t('generatedAt'), snapshot.value.generatedAt],
    [
      t('search'),
      applied.value,
      t('status'),
      t(subset.value === 'NEEDED' ? 'needed' : subset.value === 'COVERED' ? 'covered' : 'allMaterials'),
    ],
    [
      t('code'),
      t('material'),
      t('available'),
      t('threshold'),
      t('shortage'),
      t('pending'),
      t('onOrderCount'),
      t('suggested'),
    ],
  ]
  for (const row of rows.value)
    data.push([
      row.code,
      `${row.name} (${row.unit})`,
      row.availableQuantity ?? row.quantity,
      row.reorderPoint,
      row.shortage,
      row.pendingQuantity,
      row.pendingOrderCount,
      row.recommendedQuantity,
    ])
  downloadCsv(`replenishment-${new Date().toISOString().slice(0, 10)}.csv`, data)
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <section class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
    <div class="flex flex-wrap justify-end gap-2">
      <Button
        class="mr-auto sm:hidden"
        variant="outline"
        :aria-expanded="filtersOpen"
        aria-controls="replenishment-filters"
        @click="filtersOpen = !filtersOpen"
      >
        {{ t('filters') }}
      </Button>
      <Button variant="outline" :disabled="loading || dirty" @click="load">{{ t('refresh') }}</Button>
      <Button variant="outline" :disabled="loading || dirty || !!error || !rows.length" @click="exportSnapshot">
        {{ t('exportSnapshot') }}
      </Button>
    </div>
    <form
      id="replenishment-filters"
      :data-open="filtersOpen"
      class="replenishment-filters flex flex-wrap items-end gap-3"
      @submit.prevent="apply"
    >
      <label class="grow">
        {{ t('materialSearch') }}
        <input v-model="keyword" type="search" maxlength="120" />
      </label>
      <label>
        {{ t('status') }}
        <select v-model="subset" :aria-label="t('status')">
          <option value="NEEDED">{{ t('needed') }}</option>
          <option value="COVERED">{{ t('covered') }}</option>
          <option value="ALL">{{ t('allMaterials') }}</option>
        </select>
      </label>
      <Button type="submit" variant="outline" :disabled="loading">{{ t('find') }}</Button>
    </form>
    <details class="help">
      <summary class="cursor-pointer">{{ t('calculation') }}</summary>
      <p class="mt-2">{{ t('restockHint') }}</p>
    </details>
    <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
    <p v-if="loading" role="status" class="help py-6 text-center">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert">
      <p class="error">{{ t(error) }}</p>
      <Button variant="outline" @click="load">{{ t('refresh') }}</Button>
    </div>
    <template v-else-if="snapshot && !dirty">
      <dl class="grid grid-cols-2 gap-3">
        <div class="rounded-md border p-3">
          <dt class="help">{{ t('needed') }}</dt>
          <dd class="mt-2 text-lg font-semibold">{{ number(snapshot.summary.neededCount) }}</dd>
        </div>
        <div class="rounded-md border p-3">
          <dt class="help">{{ t('covered') }}</dt>
          <dd class="mt-2 text-lg font-semibold">{{ number(snapshot.summary.coveredCount) }}</dd>
        </div>
      </dl>
      <p v-if="!rows.length && subset === 'NEEDED'" class="help py-6 text-center">{{ t('noExtraNeed') }}</p>
      <AnalysisTable
        v-else
        :rows="display"
        :title-heading="t('material')"
        :quantity-heading="t('suggested')"
        :value-heading="t('pending')"
        @action="create"
      />
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{{ rows.length }} {{ t('records') }} · {{ t('page') }} {{ page }} / {{ pages }}</span>
        <div class="flex gap-2">
          <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">{{ t('previous') }}</Button>
          <Button size="sm" variant="outline" :disabled="page >= pages" @click="page++">{{ t('next') }}</Button>
        </div>
      </div>
      <p class="help">{{ t('generatedAt') }}: {{ date(snapshot.generatedAt) }}</p>
    </template>
  </section>
</template>
<style scoped src="./purchasing.css"></style>
<style scoped>
@media (max-width: 639px) {
  .replenishment-filters:not([data-open='true']) {
    display: none;
  }
}
</style>
