<script setup lang="ts">
import { readMerchantViewData } from '@/lib/merchant-view-data'
import DataActionButton from '@/components/DataActionButton.vue'
import ListToolbar from '@/components/table/ListToolbar.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import TableAction from '@/components/table/TableAction.vue'
import { Settings } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { InventoryRecipePage, InventoryRecipeRecord } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { Table } from '@lingdian/console-ui/table'
import RecipeEditor from './RecipeEditor.vue'
import { useLocale } from '@/i18n/locale'
import { listInventoryRecipes } from '@/services/inventory'
import { en, zh, type MessageKey } from './messages'

const props = defineProps<{ storeId: string }>()
const { locale } = useLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const result = ref<InventoryRecipePage>()
const keyword = ref('')
const appliedKeyword = ref('')
const dirty = computed(() => keyword.value.trim() !== appliedKeyword.value)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<MessageKey | ''>('')
const editing = ref<InventoryRecipeRecord>(), saved = ref(false)
let sequence = 0
function errorKey(value: unknown, fallback: MessageKey = 'loadFailed'): MessageKey { const key = value instanceof Error ? value.message : ''; return Object.hasOwn(zh, key) ? key as MessageKey : fallback }
async function load(refresh = true) {
  const current = ++sequence; loading.value = true; error.value = ''
  try {
    const query = [props.storeId, page.value, appliedKeyword.value, pageSize.value] as const
    const data = await readMerchantViewData(['inventory-recipes', ...query], () => listInventoryRecipes(...query), refresh)
    if (current === sequence) result.value = data
  }
  catch (value) { if (current === sequence) error.value = errorKey(value) }
  finally { if (current === sequence) loading.value = false }
}
function go(nextPage: number, size = pageSize.value) {
  page.value = nextPage
  pageSize.value = size
  void load()
}
function search() {
  appliedKeyword.value = keyword.value.trim()
  go(1)
}
function reset() {
  keyword.value = ''
  search()
}
function ingredients(item: InventoryRecipeRecord) {
  return item.entries.map((entry) => `${entry.name} ${entry.quantity.toLocaleString(locale.value)} ${entry.unit}`).join(' · ')
}
function edit(item: InventoryRecipeRecord) { editing.value = item; saved.value = false }
function savedRecipe() { saved.value = true; void load() }
onMounted(() => void load(false))
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <section>
    <form id="inventory-recipe-filters" class="flex flex-wrap items-end gap-3 px-4 pt-4" @submit.prevent="search">
      <label>{{ t('search') }}<Input v-model="keyword" type="search" maxlength="120" /></label>
    </form>
    <ListToolbar class="border-b px-4 py-3">
      <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || dirty" @click="load()" />
      <Button type="submit" form="inventory-recipe-filters" variant="outline" :disabled="loading">{{ t('searchButton') }}</Button>
      <Button type="button" variant="ghost" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
    </ListToolbar>
    <p v-if="saved" role="status" class="px-4 pt-3 text-sm text-emerald-700">{{ t('recipeSaved') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert" class="grid justify-items-start gap-3 p-8 text-sm text-destructive"><p>{{ t(error) }}</p><DataActionButton action="refresh" :label="t('refresh')" @click="load()" /></div>
    <p v-else-if="!result?.items.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('noResults') }}</p>
    <template v-else>
      <Table framed tabindex="0" container-class="mx-4 mt-4 hidden md:block" :aria-label="t('recipes')" class="border-collapse text-start">
        <thead><tr><th scope="col">{{ locale === 'en-US' ? 'Product / variant' : '商品 / 规格' }}</th><th scope="col">{{ t('ingredient') }}</th><th scope="col">{{ t('actions') }}</th></tr></thead>
        <tbody>
          <tr v-for="item in result.items" :key="item.skuId">
            <th scope="row" class="min-w-36 break-words font-medium">{{ item.productName }} · {{ item.skuName }}</th>
            <td class="min-w-36 whitespace-normal break-words">{{ ingredients(item) || t('unconfigured') }}</td>
            <td><TableAction :icon="Settings" :label="t('configure')" :aria-label="`${t('configure')} ${item.productName} ${item.skuName}`" @click="edit(item)" /></td>
          </tr>
        </tbody>
      </Table>
      <ul tabindex="0" :aria-label="t('recipes')" class="table-scroll divide-y md:hidden">
        <li v-for="item in result.items" :key="item.skuId" class="flex items-start justify-between gap-3 p-4">
          <div class="min-w-0"><h3 class="break-words text-sm font-medium">{{ item.productName }} · {{ item.skuName }}</h3><p v-if="!item.entries.length" class="mt-2 text-xs text-muted-foreground">{{ t('unconfigured') }}</p><p v-else class="mt-2 break-words text-sm text-muted-foreground">{{ ingredients(item) }}</p></div>
          <TableAction :icon="Settings" :label="t('configure')" :aria-label="`${t('configure')} ${item.productName} ${item.skuName}`" @click="edit(item)" />
        </li>
      </ul>
    </template>
    <div class="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
      <span>{{ result?.total ?? 0 }} {{ t('total') }}</span>
      <TablePagination
        :page="page"
        :pages="Math.ceil((result?.total ?? 0) / pageSize)"
        :page-size="pageSize"
        :disabled="loading"
        @update:page="go($event)"
        @update:page-size="go(1, $event)"
      />
    </div>
    <RecipeEditor v-if="editing" :store-id="storeId" :sku-id="editing.skuId" :record="editing" @close="editing=undefined" @saved="savedRecipe" />
  </section>
</template>

<style scoped>
label { display: grid; min-width: 0; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
</style>
