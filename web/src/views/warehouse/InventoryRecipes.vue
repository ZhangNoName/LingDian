<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import TableAction from '@/components/table/TableAction.vue'
import { Settings } from '@lingdian/icons/web'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { InventoryRecipePage, InventoryRecipeRecord } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
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
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<MessageKey | ''>('')
const editing = ref<InventoryRecipeRecord>(), saved = ref(false)
let sequence = 0
function errorKey(value: unknown, fallback: MessageKey = 'loadFailed'): MessageKey { const key = value instanceof Error ? value.message : ''; return Object.hasOwn(zh, key) ? key as MessageKey : fallback }
async function load() {
  const current = ++sequence; loading.value = true; error.value = ''
  try { const data = await listInventoryRecipes(props.storeId, page.value, appliedKeyword.value, pageSize.value); if (current === sequence) result.value = data }
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
function edit(item: InventoryRecipeRecord) { editing.value = item; saved.value = false }
function savedRecipe() { saved.value = true; void load() }
onMounted(load)
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <section>
    <form class="flex flex-wrap items-end gap-3 border-b p-4" @submit.prevent="search"><label>{{ t('search') }}<Input v-model="keyword" type="search" maxlength="120" /></label><Button variant="outline" :disabled="loading">{{ t('searchButton') }}</Button></form>
    <p v-if="saved" role="status" class="px-4 pt-3 text-sm text-emerald-700">{{ t('recipeSaved') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert" class="grid justify-items-start gap-3 p-8 text-sm text-destructive"><p>{{ t(error) }}</p><DataActionButton action="refresh" :label="t('refresh')" @click="load" /></div>
    <p v-else-if="!result?.items.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('noResults') }}</p>
    <ul v-else tabindex="0" :aria-label="t('recipes')" class="table-scroll divide-y">
      <li v-for="item in result.items" :key="item.skuId" class="flex items-start justify-between gap-3 p-4">
        <div class="min-w-0"><h3 class="break-words text-sm font-medium">{{ item.productName }} · {{ item.skuName }}</h3><p v-if="!item.entries.length" class="mt-2 text-xs text-muted-foreground">{{ t('unconfigured') }}</p><p v-else class="mt-2 break-words text-sm text-muted-foreground">{{ item.entries.map((entry) => `${entry.name} ${entry.quantity.toLocaleString(locale)} ${entry.unit}`).join(' · ') }}</p></div>
        <TableAction :icon="Settings" :label="t('configure')" @click="edit(item)" />
      </li>
    </ul>
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
