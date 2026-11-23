<script setup lang="ts">
import { Badge } from '@lingdian/console-ui/badge'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import { parseTablePageSize } from '@/components/table/page-size'
import TableAction from '@/components/table/TableAction.vue'
import { EyeIcon } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { StocktakePage, StocktakeStatus } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { listStocktakes } from '@/services/stocktakes'
import { useStocktakeLocale } from './locale'
import CreateStocktake from './CreateStocktake.vue'
import StocktakeDetail from './StocktakeDetail.vue'
const props = defineProps<{ storeId: string; storeName: string }>(),
  route = useRoute(),
  router = useRouter(),
  { t, date } = useStocktakeLocale()
const keyword = ref(''),
  status = ref<StocktakeStatus | 'ALL'>('ALL'),
  result = ref<StocktakePage>(),
  loading = ref(false),
  failed = ref(false),
  creating = ref(false)
const state = computed(() => ({
    keyword: typeof route.query.stocktakeKeyword === 'string' ? route.query.stocktakeKeyword.trim().slice(0, 120) : '',
    status: (['DRAFT', 'POSTED', 'CANCELLED'].includes(String(route.query.stocktakeStatus))
      ? String(route.query.stocktakeStatus)
      : 'ALL') as StocktakeStatus | 'ALL',
    pageSize: parseTablePageSize(route.query.stocktakePageSize),
    page: Math.min(1000000, Math.max(1, Number.parseInt(String(route.query.stocktakePage ?? 1)) || 1)),
  })),
  id = computed(() => (typeof route.query.stocktakeId === 'string' ? route.query.stocktakeId : ''))
const filterDirty = computed(() => keyword.value.trim() !== state.value.keyword || status.value !== state.value.status)
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  failed.value = false
  try {
    const data = await listStocktakes(props.storeId, state.value.page, state.value.keyword, state.value.status, state.value.pageSize)
    if (current === sequence) {
      result.value = data
      const last = Math.max(1, Math.ceil(data.total / state.value.pageSize))
      if (state.value.page > last) void navigate(last)
    }
  } catch {
    if (current === sequence) failed.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => [props.storeId, state.value.keyword, state.value.status, state.value.page, state.value.pageSize],
  () => {
    keyword.value = state.value.keyword
    status.value = state.value.status
    void load()
  },
  { immediate: true },
)
function navigate(page = 1, pageSize = state.value.pageSize) {
  return router.push({
    query: {
      ...route.query,
      stocktakeKeyword: keyword.value.trim() || undefined,
      stocktakeStatus: status.value === 'ALL' ? undefined : status.value,
      stocktakePageSize: pageSize === 20 ? undefined : String(pageSize),
      stocktakePage: page === 1 ? undefined : String(page),
    },
  })
}
function search() {
  if (keyword.value.trim() === state.value.keyword && status.value === state.value.status && state.value.page === 1)
    void load()
  else void navigate()
}
function open(id: string) {
  void router.push({ query: { ...route.query, stocktakeId: id || undefined } })
}
function created(id: string) {
  void load()
  open(id)
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <section class="grid min-w-0 gap-4 p-4">
    <div class="flex flex-wrap justify-end gap-2">
      <DataActionButton action="refresh" :label="t('reload')" :disabled="loading || filterDirty" @click="load" /><Button @click="creating = true">{{ t('new') }}</Button>
    </div>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="search">
      <label class="grow">{{ t('filter') }}<Input v-model="keyword" type="search" maxlength="120" /></label
      ><label
        >{{ t('status')
        }}<SelectField
          v-model="status"
          :aria-label="t('status')"
          :options="(['ALL', 'DRAFT', 'POSTED', 'CANCELLED'] as const).map((value) => ({ value, label: t(value) }))"
        /></label
      ><Button type="submit" variant="outline" :disabled="loading">{{ t('apply') }}</Button>
    </form>
    <p v-if="loading" role="status" class="help py-8 text-center">{{ t('loading') }}</p>
    <div v-else-if="failed" role="alert">
      <p>{{ t('failed') }}</p>
      <DataActionButton action="refresh" :label="t('reload')" @click="load" />
    </div>
    <p v-else-if="!result?.total" class="help py-8 text-center">{{ t('empty') }}</p>
    <ul v-else class="table-scroll grid gap-3">
      <li
        v-for="row in result.items"
        :key="row.id"
        class="flex flex-wrap items-center justify-between gap-3 border p-3 text-sm"
      >
        <div class="min-w-0">
          <strong class="break-words">{{ row.title }}</strong>
          <p class="help mt-1">
            <Badge :variant="row.status === 'POSTED' ? 'success' : row.status === 'DRAFT' ? 'warning' : 'secondary'">{{ t(row.status) }}</Badge> · {{ t('progress') }}
            {{ row.lines.filter((line) => line.countedQuantity !== null).length }} / {{ row.lines.length }} ·
            {{ date(row.createdAt) }}
          </p>
        </div>
        <TableAction :icon="EyeIcon" :label="t('detail')" :aria-label="`${t('detail')} ${row.title}`" @click="open(row.id)" />
      </li>
    </ul>
    <div v-if="!loading && !failed" class="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{{ result?.total ?? 0 }} {{ t('total') }}</span>
      <div class="flex gap-2">
        <TablePagination
          :page-size="state.pageSize"
          @update:page-size="navigate(1, $event)"
          :page="state.page"
          :pages="Math.ceil((result?.total ?? 0) / state.pageSize)"
          :disabled="filterDirty"
          @update:page="navigate($event)"
        />
      </div>
    </div>
    <CreateStocktake v-model:open="creating" :store-id="storeId" @saved="created" /><StocktakeDetail
      v-if="id"
      :id="id"
      :store-id="storeId"
      :store-name="storeName"
      @close="open('')"
      @saved="load"
    />
  </section>
</template>
<style scoped src="../purchasing/purchasing.css"></style>
