<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Button } from '@/baseComponents/button'
import {
  getMerchantProduct,
  getMerchantProductStats,
  listMerchantProducts,
  listMerchantSkuOptions,
  saveMerchantProductConfig,
} from '@/services/products'
import ProductConfigDialog from './components/ProductConfigDialog.vue'
import ProductMetricsGrid from './components/ProductMetricsGrid.vue'
import { useProductLocale } from './use-product-locale'
import { parseProductState, productListKey, productStateQuery, type ProductFilterState } from './filter-state'
import type { ProductConfigForm, ProductListRecord, ProductRecord, ProductStats } from './types'
import type { ProductMessageKey } from './messages'
const { locale, t, money } = useProductLocale(),
  route = useRoute(),
  router = useRouter()
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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">{{ t('subtitle') }}</p>
      <label class="sr-only" for="product-language">{{ t('language') }}</label>
      <select id="product-language" v-model="locale">
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English</option>
      </select>
    </div>
    <ProductMetricsGrid :metrics="metrics" />
    <p class="text-xs text-muted-foreground">{{ t('metricsHint') }}</p>
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between gap-3 border-b p-4">
        <Button
          class="sm:hidden"
          variant="outline"
          aria-controls="product-filters"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          {{ t('filters') }}
        </Button>
        <h2 class="hidden text-sm font-semibold sm:block">{{ t('title') }}</h2>
        <Button variant="outline" :disabled="loading || dirty" @click="load">{{ t('refresh') }}</Button>
      </div>
      <form
        id="product-filters"
        :data-open="filtersOpen"
        class="product-filters flex flex-wrap items-end gap-3 p-4"
        @submit.prevent="apply"
      >
        <label class="grow sm:grow-0">
          {{ t('search') }}
          <input v-model="filters.keyword" type="search" maxlength="120" />
        </label>
        <label>
          {{ t('type') }}
          <select v-model="filters.type" :aria-label="t('type')">
            <option value="">{{ t('all') }}</option>
            <option value="SINGLE">{{ t('SINGLE') }}</option>
            <option value="PACKAGE">{{ t('PACKAGE') }}</option>
          </select>
        </label>
        <Button type="button" variant="outline" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
        <Button type="submit" :disabled="loading">{{ t('apply') }}</Button>
      </form>
    </div>
    <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
    <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
    <div class="min-w-0 rounded-lg border bg-card">
      <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="loadError" role="alert" class="p-8 text-sm">
        <p>{{ t('loadFailed') }}</p>
        <Button variant="outline" class="mt-3" @click="load">{{ t('refresh') }}</Button>
      </div>
      <p v-else-if="!products.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('empty') }}</p>
      <div v-else>
        <div class="hidden overflow-x-auto md:block" tabindex="0" :aria-label="t('title')">
          <table>
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
                <td>{{ t(product.type) }}</td>
                <td>
                  {{ t(product.status) }}
                  <span
                    v-if="!product.skus.some((sku) => sku.is_active)"
                    class="mt-1 block whitespace-normal text-xs text-muted-foreground"
                  >
                    {{ t('noActiveVariants') }}
                  </span>
                </td>
                <td class="tabular-nums">{{ money(product.price) }}</td>
                <td class="tabular-nums">
                  {{ product.skus.filter((sku) => sku.is_active).length }} / {{ product.selection_group_count }}
                </td>
                <td>
                  <Button
                    variant="outline"
                    size="sm"
                    :aria-label="`${t('configure')} ${product.name}`"
                    @click="navigate({ ...state, productId: product.id })"
                  >
                    {{ t('configure') }}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul class="divide-y md:hidden">
          <li v-for="product in products" :key="product.id" class="grid gap-3 p-4 text-sm">
            <div class="flex justify-between gap-3">
              <div class="min-w-0">
                <h3 class="break-words font-medium">{{ product.name }}</h3>
                <p class="mt-1 text-xs text-muted-foreground">{{ product.category }} · {{ t(product.type) }}</p>
                <p v-if="!product.skus.some((sku) => sku.is_active)" class="mt-1 text-xs text-muted-foreground">
                  {{ t('noActiveVariants') }}
                </p>
              </div>
              <span class="shrink-0">{{ t(product.status) }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <strong class="tabular-nums">{{ money(product.price) }}</strong>
              <Button
                variant="outline"
                size="sm"
                :aria-label="`${t('configure')} ${product.name}`"
                @click="navigate({ ...state, productId: product.id })"
              >
                {{ t('configure') }}
              </Button>
            </div>
          </li>
        </ul>
      </div>
      <div
        v-if="!loadError"
        class="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground"
      >
        <span>{{ total }} {{ t('records') }} · {{ t('page') }} {{ state.page }} / {{ pageCount }}</span>
        <label>
          {{ t('pageSize') }}
          <select
            :value="state.pageSize"
            :aria-label="t('pageSize')"
            :disabled="loading || dirty"
            @change="navigate({ ...state, page: 1, pageSize: Number(($event.target as HTMLSelectElement).value) })"
          >
            <option v-for="size in [20, 50, 100]" :key="size" :value="size">{{ size }}</option>
          </select>
        </label>
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            :disabled="loading || dirty || state.page <= 1"
            @click="navigate({ ...state, page: state.page - 1 })"
          >
            {{ t('previous') }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="loading || dirty || state.page >= pageCount"
            @click="navigate({ ...state, page: state.page + 1 })"
          >
            {{ t('next') }}
          </Button>
        </div>
      </div>
    </div>
    <footer class="text-xs leading-5 text-muted-foreground">
      <p>{{ t('stockHint') }}</p>
      <p>{{ t('noNewProduct') }}</p>
      <RouterLink class="mt-2 inline-block text-sm text-primary" to="/warehouse?view=recipes">
        {{ t('recipeLink') }}
      </RouterLink>
    </footer>
    <ProductConfigDialog
      :open="configOpen"
      :product="active"
      :saving="saving"
      :loading="configLoading"
      :error="configError"
      :external-sku-choices="choices"
      @update:open="close"
      @save="save"
      @retry="loadConfig"
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
table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
  font-size: 0.875rem;
}
th,
td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--ld-border-default);
  white-space: nowrap;
}
thead th {
  font-size: 0.75rem;
  color: var(--ld-text-muted);
  font-weight: 500;
}
@media (max-width: 639px) {
  .product-filters:not([data-open='true']) {
    display: none;
  }
}
</style>
