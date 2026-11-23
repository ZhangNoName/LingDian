<script setup lang="ts">
import FilterToggle from '@/components/FilterToggle.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import { extendedTablePageSizes } from '@/components/table/page-size'
import TableAction from '@/components/table/TableAction.vue'
import { Settings } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Badge } from '@lingdian/console-ui/badge'
import { catalogStatusBadge } from './catalog-lifecycle'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { Table } from '@lingdian/console-ui/table'
import {
  getMerchantProduct,
  getMerchantProductStats,
  listMerchantProducts,
  listMerchantSkuOptions,
  saveMerchantProductConfig,
} from '@/services/products'
import { merchantStore } from '@/auth/merchant-store'
import NewProductDialog from './components/NewProductDialog.vue'
import CategoryManager from './categories/CategoryManager.vue'
import { useCatalogLocale } from './catalog-management-locale'
import ProductConfigDialog from './components/ProductConfigDialog.vue'
import SummaryMetrics from '@/components/SummaryMetrics.vue'
import { useProductLocale } from './use-product-locale'
import { parseProductState, productListKey, productStateQuery, type ProductFilterState } from './filter-state'
import type { ProductConfigForm, ProductListRecord, ProductRecord, ProductStats } from './types'
import type { ProductMessageKey } from './messages'
const { locale, t, money } = useProductLocale(),
  route = useRoute(),
  router = useRouter()
const { t: ct } = useCatalogLocale(),
  newProductOpen = ref(false),
  categoriesOpen = ref(false)
const state = ref(parseProductState(route.query)),
  filters = reactive({ keyword: '', type: '' as ProductFilterState['type'] })
const products = ref<ProductListRecord[]>([]),
  total = ref(0),
  stats = ref<ProductStats>(),
  loading = ref(true),
  loadError = ref(false),
  filtersOpen = ref(false),
  saved = ref(false)
const active = ref<ProductRecord | null>(null),
  configOpen = ref(false),
  configLoading = ref(false),
  configError = ref<ProductMessageKey>(),
  saving = ref(false),
  choices = ref<Array<{ value: string; label: string }>>([])
const dirty = computed(() => filters.keyword.trim() !== state.value.keyword || filters.type !== state.value.type)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / state.value.pageSize)))
const metrics = computed(() =>
  [
    { key: 'total' as const, value: stats.value?.total_count },
    { key: 'active' as const, value: stats.value?.active_count },
    { key: 'packages' as const, value: stats.value?.package_count },
    { key: 'variantsCount' as const, value: stats.value?.sku_count },
    { key: 'groupsCount' as const, value: stats.value?.selection_group_count },
  ].map((metric) => ({ label: t(metric.key), value: loading.value || loadError.value ? '—' : (metric.value ?? 0) })),
)
let listSequence = 0,
  configSequence = 0,
  lastList = '',
  selectedId = '',
  disposed = false
function navigate(next: ProductFilterState) {
  return router.push({ query: productStateQuery(next) })
}
async function load() {
  const current = ++listSequence
  loading.value = true
  loadError.value = false
  try {
    const [data, counts] = await Promise.all([listMerchantProducts(state.value), getMerchantProductStats()])
    if (current === listSequence) {
      const last = Math.max(1, Math.ceil(data.total / state.value.pageSize))
      if (state.value.page > last) {
        await navigate({ ...state.value, page: last })
        return
      }
      products.value = data.items
      total.value = data.total
      stats.value = counts
    }
  } catch {
    if (current === listSequence) loadError.value = true
  } finally {
    if (current === listSequence) loading.value = false
  }
}
async function loadConfig() {
  const current = ++configSequence
  configLoading.value = true
  configError.value = undefined
  active.value = null
  saved.value = false
  try {
    const [product, skuOptions] = await Promise.all([getMerchantProduct(selectedId), listMerchantSkuOptions()])
    if (current === configSequence) {
      active.value = product
      choices.value = skuOptions
    }
  } catch {
    if (current === configSequence) configError.value = 'loadFailed'
  } finally {
    if (current === configSequence) configLoading.value = false
  }
}
async function save(payload: ProductConfigForm) {
  if (!active.value || saving.value) return
  const id = active.value.id
  saving.value = true
  configError.value = undefined
  try {
    await saveMerchantProductConfig(id, payload)
    if (disposed) return
    saved.value = true
    await navigate({ ...state.value, productId: '' })
    await load()
  } catch (value) {
    if (!disposed) {
      const key = value instanceof Error ? value.message : ''
      configError.value =
        key === 'catalog.stale'
          ? 'stale'
          : key === 'catalog.versionRequired'
            ? 'versionRequired'
            : key === 'catalog.variantUnavailable'
              ? 'unavailable'
              : 'saveFailed'
    }
  } finally {
    saving.value = false
  }
}
function updated(record: ProductRecord) {
  active.value = record
  saved.value = true
  void load()
}
async function created(record: ProductRecord) {
  newProductOpen.value = false
  filters.keyword = ''
  filters.type = ''
  await navigate({ ...state.value, keyword: '', type: '', page: 1, productId: record.id })
  await load()
}
async function apply() {
  const next = { ...state.value, keyword: filters.keyword.trim(), type: filters.type, page: 1 }
  if (productListKey(next) === productListKey(state.value)) await load()
  else await navigate(next)
  filtersOpen.value = false
}
function reset() {
  filters.keyword = ''
  filters.type = ''
  void apply()
}
function close(open: boolean) {
  if (!open && !saving.value) void navigate({ ...state.value, productId: '' })
}
watch(
  () => route.fullPath,
  () => {
    const next = parseProductState(route.query),
      canonical = productStateQuery(next)
    if (JSON.stringify(Object.entries(route.query).sort()) !== JSON.stringify(Object.entries(canonical).sort())) {
      void router.replace({ query: canonical })
      return
    }
    state.value = next
    const key = productListKey(next)
    if (key !== lastList) {
      lastList = key
      filters.keyword = next.keyword
      filters.type = next.type
      void load()
    }
    if (next.productId !== selectedId) {
      selectedId = next.productId
      configSequence++
      active.value = null
      configOpen.value = !!selectedId
      if (selectedId) void loadConfig()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  disposed = true
  listSequence++
  configSequence++
})
</script>
<template>
  <section class="grid min-w-0 gap-4" :lang="locale">
    <div class="flex flex-wrap justify-end gap-2">
      <Button variant="outline" @click="categoriesOpen = true">{{ locale === 'en-US' ? 'Categories' : '分类管理' }}</Button>
      <Button @click="newProductOpen = true">{{ ct('newProduct') }}</Button>
    </div>
    <SummaryMetrics :metrics="metrics" :more-label="t('moreMetrics')" desktop-columns="lg:grid-cols-5" />
    <Card class="gap-0 p-0">
      <div class="flex items-center justify-between gap-3 border-b p-4">
        <FilterToggle v-model="filtersOpen" controls="product-filters" class="sm:hidden">{{ t('filters') }}</FilterToggle>
        <h2 class="hidden text-sm font-semibold sm:block">{{ t('title') }}</h2>
        <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || dirty" @click="load" />
      </div>
      <form
        id="product-filters"
        :data-filter-open="filtersOpen"
        class="product-filters flex flex-wrap items-end gap-3 p-4"
        @submit.prevent="apply"
      >
        <label class="grow sm:grow-0">
          {{ t('search') }}
          <Input v-model="filters.keyword" type="search" maxlength="120" />
        </label>
        <label>
          {{ t('type') }}
          <SelectField
            v-model="filters.type"
            :aria-label="t('type')"
            :options="[
              { value: '', label: t('all') },
              { value: 'SINGLE', label: t('SINGLE') },
              { value: 'PACKAGE', label: t('PACKAGE') },
            ]"
          />
        </label>
        <Button type="button" variant="outline" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
        <Button type="submit" :disabled="loading">{{ t('apply') }}</Button>
      </form>
    </Card>
    <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
    <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
    <Card class="min-w-0 gap-0 p-0">
      <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="loadError" role="alert" class="p-8 text-sm">
        <p>{{ t('loadFailed') }}</p>
        <DataActionButton action="refresh" :label="t('refresh')" class="mt-3" @click="load" />
      </div>
      <p v-else-if="!products.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('empty') }}</p>
      <div v-else>
        <Table framed container-class="mx-4 mt-4 hidden md:block" tabindex="0" :aria-label="t('title')" class="border-collapse text-start">
          <thead>
            <tr>
              <th>{{ t('product') }}</th>
              <th>{{ t('type') }}</th>
              <th>{{ t('status') }}</th>
              <th>{{ t('price') }}</th>
              <th>{{ t('variantsCount') }} / {{ t('groupsCount') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product.id">
              <th scope="row" class="font-medium">
                {{ product.name }}
                <span class="mt-1 block text-xs font-normal text-muted-foreground">{{ product.category }}</span>
              </th>
              <td><Badge variant="outline">{{ t(product.type) }}</Badge></td>
              <td>
                <Badge :variant="catalogStatusBadge(product.status)">{{ t(product.status) }}</Badge>
                <span
                  v-if="!product.skus.some((sku) => sku.is_active)"
                  class="mt-1 block whitespace-normal text-xs text-muted-foreground"
                >
                  {{ t('noActiveVariants') }}
                </span>
              </td>
              <td class="font-semibold tabular-nums">{{ money(product.price) }}</td>
              <td class="tabular-nums">
                {{ product.skus.filter((sku) => sku.is_active).length }} / {{ product.selection_group_count }}
              </td>
              <td>
                <TableAction :icon="Settings" :label="t('configure')"
                  :aria-label="`${t('configure')} ${product.name}`"
                  @click="navigate({ ...state, productId: product.id })" />
              </td>
            </tr>
          </tbody>
        </Table>
        <ul class="table-scroll divide-y md:hidden">
          <li v-for="product in products" :key="product.id" class="grid gap-3 p-4 text-sm">
            <div class="flex justify-between gap-3">
              <div class="min-w-0">
                <h3 class="break-words font-medium">{{ product.name }}</h3>
                <p class="mt-1 text-xs text-muted-foreground">{{ product.category }} · {{ t(product.type) }}</p>
                <p v-if="!product.skus.some((sku) => sku.is_active)" class="mt-1 text-xs text-muted-foreground">
                  {{ t('noActiveVariants') }}
                </p>
              </div>
              <Badge :variant="catalogStatusBadge(product.status)">{{ t(product.status) }}</Badge>
            </div>
            <div class="flex items-center justify-between gap-3">
              <strong class="tabular-nums">{{ money(product.price) }}</strong>
              <TableAction :icon="Settings" :label="t('configure')"
                :aria-label="`${t('configure')} ${product.name}`"
                @click="navigate({ ...state, productId: product.id })" />
            </div>
          </li>
        </ul>
      </div>
      <div
        v-if="!loadError"
        class="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground md:border-t-0"
      >
        <span>{{ total }} {{ t('records') }}</span>
        <div class="flex gap-2">
          <TablePagination
            :page-size="state.pageSize"
            @update:page-size="navigate({ ...state, page: 1, pageSize: $event })"
            :page-sizes="extendedTablePageSizes"
            :page="state.page"
            :pages="pageCount"
            :disabled="loading || dirty"
            @update:page="navigate({ ...state, page: $event })"
          />
        </div>
      </div>
    </Card>
    <footer>
      <RouterLink class="inline-block text-sm text-primary" to="/warehouse?view=recipes">
        {{ t('recipeLink') }}
      </RouterLink>
    </footer>
    <CategoryManager v-model:open="categoriesOpen" :store-id="merchantStore.selectedId.value" @changed="load" />
    <NewProductDialog v-model:open="newProductOpen" :store-id="merchantStore.selectedId.value" @saved="created" />
    <ProductConfigDialog
      :open="configOpen"
      :store-id="merchantStore.selectedId.value"
      :product="active"
      :saving="saving"
      :loading="configLoading"
      :error="configError"
      :external-sku-choices="choices"
      @update:open="close"
      @save="save"
      @retry="loadConfig"
      @updated="updated"
    />
  </section>
</template>
<style scoped>
.product-filters label {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--ld-text-muted);
}
</style>
