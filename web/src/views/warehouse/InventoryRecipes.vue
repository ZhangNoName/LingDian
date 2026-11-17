<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { InventoryItemContract, InventoryRecipePage, InventoryRecipeRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { useLocale } from '@/i18n/locale'
import { listInventory, listInventoryRecipes, saveInventoryRecipe } from '@/services/inventory'
import { en, zh, type MessageKey } from './messages'

const props = defineProps<{ storeId: string }>()
const { locale } = useLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const result = ref<InventoryRecipePage>(), keyword = ref(''), page = ref(1), loading = ref(true), error = ref<MessageKey | ''>('')
const editing = ref<InventoryRecipeRecord>(), entries = ref<{ itemId: string; quantity: number }[]>([]), materials = ref<InventoryItemContract[]>([])
const materialKeyword = ref(''), materialTotal = ref(0), loadingMaterials = ref(false), saving = ref(false), formError = ref<MessageKey | ''>(''), saved = ref(false)
const options = computed(() => {
  const map = new Map(materials.value.map((item) => [item.id, { id: item.id, name: item.name, code: item.code, unit: item.unit }]))
  for (const item of editing.value?.entries ?? []) if (!map.has(item.itemId)) map.set(item.itemId, { id: item.itemId, name: item.name, code: item.code, unit: item.unit })
  return [...map.values()]
})
let sequence = 0, materialSequence = 0
function errorKey(value: unknown, fallback: MessageKey = 'loadFailed'): MessageKey { const key = value instanceof Error ? value.message : ''; return Object.hasOwn(zh, key) ? key as MessageKey : fallback }
async function load() {
  const current = ++sequence; loading.value = true; error.value = ''
  try { const data = await listInventoryRecipes(props.storeId, page.value, keyword.value.trim()); if (current === sequence) result.value = data }
  catch (value) { if (current === sequence) error.value = errorKey(value) }
  finally { if (current === sequence) loading.value = false }
}
async function loadMaterials() {
  const current = ++materialSequence; loadingMaterials.value = true; formError.value = ''
  try { const data = await listInventory(props.storeId, { page: 1, pageSize: 100, keyword: materialKeyword.value }); if (current === materialSequence) { materials.value = [...materials.value.filter((item) => entries.value.some((entry) => entry.itemId === item.id)), ...data.items]; materialTotal.value = data.total } }
  catch (value) { if (current === materialSequence) formError.value = errorKey(value) }
  finally { if (current === materialSequence) loadingMaterials.value = false }
}
function edit(item: InventoryRecipeRecord) { editing.value = item; entries.value = item.entries.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })); materialKeyword.value = ''; saved.value = false; void loadMaterials() }
async function save() {
  if (!editing.value || saving.value) return
  saving.value = true; formError.value = ''
  try {
    await saveInventoryRecipe(props.storeId, editing.value.skuId, { expectedVersion: editing.value.version, entries: entries.value.map((entry) => ({ itemId: entry.itemId, quantity: Number(entry.quantity) })) })
    editing.value = undefined; saved.value = true; await load()
  } catch (value) { formError.value = errorKey(value, 'unexpected') }
  finally { saving.value = false }
}
function close(open: boolean) { if (!open && !saving.value) { editing.value = undefined; materialSequence++ } }
onMounted(load)
onBeforeUnmount(() => { sequence++; materialSequence++ })
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
    <Dialog :open="!!editing" @update:open="close">
      <DialogContent class="max-h-[90dvh] max-w-2xl overflow-y-auto" :close-label="t('cancel')">
        <DialogHeader><DialogTitle>{{ t('recipes') }} · {{ editing?.productName }} · {{ editing?.skuName }}</DialogTitle><DialogDescription>{{ t('recipeHint') }}</DialogDescription></DialogHeader>
        <div class="flex flex-wrap items-end gap-2"><label class="grow">{{ t('materialSearch') }}<input v-model="materialKeyword" type="search" maxlength="120" :disabled="saving" @keydown.enter.prevent="loadMaterials" /></label><Button variant="outline" :disabled="loadingMaterials || saving" @click="loadMaterials">{{ t('searchButton') }}</Button></div>
        <p v-if="materialTotal > 100" class="text-xs text-muted-foreground">{{ t('materialLimit') }}</p>
        <form class="grid gap-4" @submit.prevent="save">
          <fieldset :disabled="saving" class="grid min-w-0 gap-3">
            <div v-for="(entry, index) in entries" :key="index" class="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
              <label>{{ t('ingredient') }}<select v-model="entry.itemId" required :aria-label="`${t('ingredient')} ${index + 1}`"><option disabled value="">—</option><option v-for="item in options" :key="item.id" :value="item.id">{{ item.name }} · {{ item.code }} ({{ item.unit }})</option></select></label>
              <label>{{ t('perUnit') }}<input v-model.number="entry.quantity" type="number" min="0.001" max="999999" step="0.001" required /></label>
              <Button type="button" variant="ghost" @click="entries.splice(index, 1)">{{ t('remove') }}</Button>
            </div>
            <Button type="button" variant="outline" :disabled="entries.length >= 20 || loadingMaterials" @click="entries.push({ itemId: '', quantity: 1 })">{{ t('addIngredient') }}</Button>
          </fieldset>
          <p class="text-xs leading-5 text-muted-foreground">{{ t('recipeClearHint') }}</p>
          <p v-if="formError" role="alert" class="text-sm text-destructive">{{ t(formError) }}</p>
          <div class="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" :disabled="saving" @click="close(false)">{{ t('cancel') }}</Button><Button type="submit" :disabled="saving || loadingMaterials">{{ t(saving ? 'saving' : 'save') }}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>
</template>

<style scoped>
label { display: grid; min-width: 0; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
input, select { min-width: 0; max-width: 100%; min-height: 2.25rem; border: 1px solid var(--ld-border-default); border-radius: .375rem; padding: .5rem .625rem; background: var(--ld-bg-elevated); color: var(--ld-text-heading); font-size: .875rem; }
input:focus-visible, select:focus-visible { outline: 2px solid var(--ld-color-primary); outline-offset: 2px; }
</style>
