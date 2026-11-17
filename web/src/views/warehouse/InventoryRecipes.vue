<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { InventoryRecipePage, InventoryRecipeRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import RecipeEditor from './RecipeEditor.vue'
import { useLocale } from '@/i18n/locale'
import { listInventoryRecipes } from '@/services/inventory'
import { en, zh, type MessageKey } from './messages'

const props = defineProps<{ storeId: string }>()
const { locale } = useLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const result = ref<InventoryRecipePage>(), keyword = ref(''), page = ref(1), loading = ref(true), error = ref<MessageKey | ''>('')
const editing = ref<InventoryRecipeRecord>(), saved = ref(false)
let sequence = 0
function errorKey(value: unknown, fallback: MessageKey = 'loadFailed'): MessageKey { const key = value instanceof Error ? value.message : ''; return Object.hasOwn(zh, key) ? key as MessageKey : fallback }
async function load() {
  const current = ++sequence; loading.value = true; error.value = ''
  try { const data = await listInventoryRecipes(props.storeId, page.value, keyword.value.trim()); if (current === sequence) result.value = data }
  catch (value) { if (current === sequence) error.value = errorKey(value) }
  finally { if (current === sequence) loading.value = false }
}
function edit(item: InventoryRecipeRecord) { editing.value = item; saved.value = false }
function savedRecipe() { saved.value = true; void load() }
onMounted(load)
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <section>
    <form class="flex flex-wrap items-end gap-3 border-b p-4" @submit.prevent="page = 1; load()"><label>{{ t('search') }}<input v-model="keyword" type="search" maxlength="120" /></label><Button variant="outline" :disabled="loading">{{ t('searchButton') }}</Button></form>
    <p v-if="saved" role="status" class="px-4 pt-3 text-sm text-emerald-700">{{ t('recipeSaved') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert" class="grid justify-items-start gap-3 p-8 text-sm text-destructive"><p>{{ t(error) }}</p><Button variant="outline" @click="load">{{ t('refresh') }}</Button></div>
    <p v-else-if="!result?.items.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('noResults') }}</p>
    <ul v-else class="divide-y">
      <li v-for="item in result.items" :key="item.skuId" class="flex items-start justify-between gap-3 p-4">
        <div class="min-w-0"><h3 class="text-sm font-medium">{{ item.productName }} · {{ item.skuName }}</h3><p v-if="!item.entries.length" class="mt-2 text-xs text-muted-foreground">{{ t('unconfigured') }}</p><p v-else class="mt-2 break-words text-sm text-muted-foreground">{{ item.entries.map((entry) => `${entry.name} ${entry.quantity.toLocaleString(locale)} ${entry.unit}`).join(' · ') }}</p></div>
        <Button size="sm" variant="outline" @click="edit(item)">{{ t('configure') }}</Button>
      </li>
    </ul>
    <div class="flex justify-between gap-3 border-t p-4 text-sm text-muted-foreground"><span>{{ result?.total ?? 0 }} {{ t('total') }}</span><div class="flex gap-2"><Button size="sm" variant="outline" :disabled="loading || page <= 1" @click="page--; load()">{{ t('previous') }}</Button><Button size="sm" variant="outline" :disabled="loading || page * 20 >= (result?.total ?? 0)" @click="page++; load()">{{ t('next') }}</Button></div></div>
    <RecipeEditor v-if="editing" :store-id="storeId" :sku-id="editing.skuId" :record="editing" @close="editing=undefined" @saved="savedRecipe" />
  </section>
</template>

<style scoped>
label { display: grid; min-width: 0; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
input, select { min-width: 0; max-width: 100%; min-height: 2.25rem; border: 1px solid var(--ld-border-default); border-radius: .375rem; padding: .5rem .625rem; background: var(--ld-bg-elevated); color: var(--ld-text-heading); font-size: .875rem; }
input:focus-visible, select:focus-visible { outline: 2px solid var(--ld-color-primary); outline-offset: 2px; }
</style>
