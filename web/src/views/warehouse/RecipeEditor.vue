<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { InventoryItemContract, InventoryRecipeRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { useLocale } from '@/i18n/locale'
import { getInventoryRecipe, listInventory, saveInventoryRecipe } from '@/services/inventory'
import { en, zh, type MessageKey } from './messages'
const props = defineProps<{ storeId: string; skuId: string; record?: InventoryRecipeRecord }>(),
  emit = defineEmits<{ close: []; saved: [] }>()
const { locale } = useLocale(),
  t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const record = ref<InventoryRecipeRecord>(),
  entries = ref<{ itemId: string; quantity: number }[]>([]),
  materials = ref<InventoryItemContract[]>([]),
  keyword = ref(''),
  total = ref(0),
  loading = ref(true),
  finding = ref(false),
  saving = ref(false),
  error = ref<MessageKey | ''>(''),
  closePending = ref(false)
let sequence = 0,
  lookupSequence = 0,
  baseline = ''
const dirty = computed(() => !!record.value && JSON.stringify(entries.value) !== baseline)
const options = computed(() => {
  const map = new Map(
    materials.value.map((item) => [item.id, { id: item.id, name: item.name, code: item.code, unit: item.unit }]),
  )
  for (const item of record.value?.entries ?? [])
    if (!map.has(item.itemId))
      map.set(item.itemId, { id: item.itemId, name: item.name, code: item.code, unit: item.unit })
  return [...map.values()]
})
function errorKey(e: unknown, fallback: MessageKey): MessageKey {
  const key = e instanceof Error ? e.message : ''
  return Object.hasOwn(zh, key) ? (key as MessageKey) : fallback
}
async function lookup() {
  const token = ++lookupSequence
  finding.value = true
  try {
    const data = await listInventory(props.storeId, { page: 1, pageSize: 100, keyword: keyword.value })
    if (token === lookupSequence) {
      materials.value = [
        ...materials.value.filter((item) => entries.value.some((entry) => entry.itemId === item.id)),
        ...data.items,
      ]
      total.value = data.total
    }
  } catch (e) {
    if (token === lookupSequence) error.value = errorKey(e, 'loadFailed')
  } finally {
    if (token === lookupSequence) finding.value = false
  }
}
async function load() {
  const token = ++sequence
  loading.value = true
  error.value = ''
  try {
    const data =
      props.record?.skuId === props.skuId ? props.record : await getInventoryRecipe(props.storeId, props.skuId)
    if (token !== sequence) return
    record.value = data
    entries.value = data.entries.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity }))
    baseline = JSON.stringify(entries.value)
    await lookup()
  } catch (e) {
    if (token === sequence) error.value = errorKey(e, 'loadFailed')
  } finally {
    if (token === sequence) loading.value = false
  }
}
watch(() => [props.storeId, props.skuId], load, { immediate: true })
function close() {
  if (!saving.value) {
    if (dirty.value) closePending.value = true
    else emit('close')
  }
}
async function save() {
  if (!record.value || saving.value || finding.value || closePending.value) return
  saving.value = true
  error.value = ''
  const token = sequence
  try {
    await saveInventoryRecipe(props.storeId, record.value.skuId, {
      expectedVersion: record.value.version,
      entries: entries.value.map((entry) => ({ itemId: entry.itemId, quantity: Number(entry.quantity) })),
    })
    if (token === sequence) {
      emit('saved')
      emit('close')
    }
  } catch (e) {
    if (token === sequence) error.value = errorKey(e, 'unexpected')
  } finally {
    if (token === sequence) saving.value = false
  }
}
onBeforeUnmount(() => {
  sequence++
  lookupSequence++
})
</script>
<template>
  <Dialog open @update:open="close"
    ><DialogContent
      class="max-h-[90dvh] max-w-2xl overflow-y-auto"
      :close-label="t('cancel')"
      :close-disabled="saving"
      @interact-outside="saving && $event.preventDefault()"
      @escape-key-down="saving && $event.preventDefault()"
      ><DialogHeader
        ><DialogTitle>{{ t('recipes') }} · {{ record?.productName }} · {{ record?.skuName }}</DialogTitle
        ><DialogDescription>{{ t('recipeHint') }}</DialogDescription></DialogHeader
      >
      <p v-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="!record" role="alert" class="grid justify-items-start gap-3 text-sm text-destructive">
        <p>{{ t(error || 'loadFailed') }}</p>
        <Button variant="outline" @click="load">{{ t('refresh') }}</Button>
      </div>
      <template v-else
        ><div class="flex flex-wrap items-end gap-2">
          <label class="grow"
            >{{ t('materialSearch')
            }}<input
              v-model="keyword"
              type="search"
              maxlength="120"
              :disabled="saving"
              @keydown.enter.prevent="lookup" /></label
          ><Button variant="outline" :disabled="finding || saving" @click="lookup">{{ t('searchButton') }}</Button>
        </div>
        <p v-if="total > 100" class="text-xs text-muted-foreground">{{ t('materialLimit') }}</p>
        <form class="grid gap-4" @submit.prevent="save">
          <fieldset :disabled="saving || closePending" class="grid min-w-0 gap-3">
            <div
              v-for="(entry, index) in entries"
              :key="index"
              class="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
            >
              <label
                >{{ t('ingredient')
                }}<select v-model="entry.itemId" required :aria-label="`${t('ingredient')} ${index + 1}`">
                  <option disabled value="">—</option>
                  <option v-for="item in options" :key="item.id" :value="item.id">
                    {{ item.name }} · {{ item.code }} ({{ item.unit }})
                  </option>
                </select></label
              ><label
                >{{ t('perUnit')
                }}<input
                  v-model.number="entry.quantity"
                  type="number"
                  min="0.001"
                  max="999999"
                  step="0.001"
                  required /></label
              ><Button type="button" variant="ghost" @click="entries.splice(index, 1)">{{ t('remove') }}</Button>
            </div>
            <Button
              type="button"
              variant="outline"
              :disabled="entries.length >= 20 || finding"
              @click="entries.push({ itemId: '', quantity: 1 })"
              >{{ t('addIngredient') }}</Button
            >
          </fieldset>
          <p class="text-xs leading-5 text-muted-foreground">{{ t('recipeClearHint') }}</p>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
          <div v-if="closePending" role="alert" class="grid gap-3 rounded-md border p-3 text-sm">
            <p>{{ t('recipeDiscard') }}</p>
            <div class="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" :disabled="saving" @click="closePending = false">{{
                t('recipeContinue')
              }}</Button
              ><Button type="button" variant="ghost" :disabled="saving" @click="$emit('close')">{{
                t('recipeDiscardConfirm')
              }}</Button>
            </div>
          </div>
          <div v-else class="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" :disabled="saving" @click="close">{{ t('cancel') }}</Button
            ><Button type="submit" :disabled="saving || finding">{{ t(saving ? 'saving' : 'save') }}</Button>
          </div>
        </form></template
      >
    </DialogContent></Dialog
  >
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
