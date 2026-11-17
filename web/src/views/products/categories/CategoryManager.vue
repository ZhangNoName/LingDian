<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CategoryContract, MerchantCategoryPage, MerchantCategoryRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { merchantCategories } from '@/services/products'
import CategoryEditor from './CategoryEditor.vue'
import { useCategoryLocale } from './locale'
const props = defineProps<{ open: boolean; storeId: string }>(),
  emit = defineEmits<{ 'update:open': [boolean]; changed: [] }>(),
  { t, number } = useCategoryLocale()
const result = ref<MerchantCategoryPage>(),
  keyword = ref(''),
  applied = ref(''),
  page = ref(1),
  loading = ref(false),
  failed = ref(false),
  editing = ref(false),
  selected = ref<MerchantCategoryRecord>(),
  busy = ref(false),
  formDirty = ref(false),
  leaving = ref<'close' | 'back'>(),
  saved = ref(false)
const dirty = computed(() => keyword.value.trim() !== applied.value)
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  failed.value = false
  try {
    const data = await merchantCategories(props.storeId, applied.value, '', page.value)
    if (current === sequence) {
      result.value = data
      const last = Math.max(1, Math.ceil(data.total / 50))
      if (page.value > last) {
        page.value = last
        void load()
      }
    }
  } catch {
    if (current === sequence) failed.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => props.open,
  (open) => {
    sequence++
    if (open) {
      keyword.value = ''
      applied.value = ''
      page.value = 1
      editing.value = false
      selected.value = undefined
      formDirty.value = false
      leaving.value = undefined
      saved.value = false
      void load()
    }
  },
)
function edit(row?: MerchantCategoryRecord) {
  selected.value = row
  formDirty.value = false
  editing.value = true
  saved.value = false
}
function requestLeave(target: 'close' | 'back') {
  if (busy.value) return
  if (formDirty.value) leaving.value = target
  else leave(target)
}
function leave(target: 'close' | 'back') {
  leaving.value = undefined
  formDirty.value = false
  editing.value = false
  selected.value = undefined
  if (target === 'close') emit('update:open', false)
  else void load()
}
function close(open: boolean) {
  if (!open) requestLeave('close')
}
function search() {
  page.value = 1
  applied.value = keyword.value.trim()
  void load()
}
function go(next: number) {
  page.value = next
  void load()
}
function onSaved(record: CategoryContract) {
  keyword.value = record.name
  applied.value = record.name
  page.value = 1
  formDirty.value = false
  editing.value = false
  selected.value = undefined
  saved.value = true
  void load()
  emit('changed')
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <Dialog :open="open" @update:open="close"
    ><DialogContent class="max-h-[92dvh] max-w-3xl overflow-y-auto" :close-label="t('close')" :close-disabled="busy"
      ><DialogHeader
        ><DialogTitle>{{ t(editing ? (selected ? 'edit' : 'new') : 'title') }}</DialogTitle
        ><DialogDescription>{{ t('hint') }}</DialogDescription></DialogHeader
      >
      <CategoryEditor
        v-if="editing"
        :store-id="storeId"
        :category="selected"
        @busy="busy = $event"
        @dirty="formDirty = $event"
        @saved="onSaved"
        @cancel="requestLeave('back')"
      />
      <div v-else class="grid min-w-0 gap-4">
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" :disabled="loading || dirty" @click="load">{{ t('reload') }}</Button
          ><Button @click="edit()">{{ t('new') }}</Button>
        </div>
        <form class="flex items-end gap-2" @submit.prevent="search">
          <label class="grid min-w-0 grow gap-1 text-xs text-muted-foreground"
            >{{ t('search')
            }}<input
              v-model="keyword"
              type="search"
              maxlength="120"
              class="rounded-md border bg-background p-2 text-sm" /></label
          ><Button type="submit" variant="outline" :disabled="loading">{{ t('find') }}</Button>
        </form>
        <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
        <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
        <p v-if="loading" role="status" class="help">{{ t('loading') }}</p>
        <div v-else-if="failed" role="alert">
          <p>{{ t('failed') }}</p>
          <Button variant="outline" @click="load">{{ t('reload') }}</Button>
        </div>
        <p v-else-if="!result?.total" class="help py-6 text-center">{{ t('empty') }}</p>
        <ul v-else class="grid gap-3 sm:grid-cols-2">
          <li v-for="row in result.items" :key="row.id" class="grid min-w-0 gap-3 rounded-md border p-3 text-sm">
            <div class="flex items-start justify-between gap-2">
              <strong class="min-w-0 break-words">{{ row.name }}</strong
              ><span class="shrink-0 text-xs text-muted-foreground">{{ t(row.is_visible ? 'shown' : 'hidden') }}</span>
            </div>
            <p class="help">
              {{ t('sort') }}: {{ number(row.sort_order) }} · {{ t('products') }} {{ number(row.product_count) }} ·
              {{ t('active') }} {{ number(row.active_product_count) }}
            </p>
            <Button
              size="sm"
              variant="outline"
              class="justify-self-end"
              :aria-label="`${t('edit')} ${row.name}`"
              @click="edit(row)"
              >{{ t('edit') }}</Button
            >
          </li>
        </ul>
        <div v-if="!loading && !failed" class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{{ number(result?.total ?? 0) }} {{ t('total') }} · {{ t('page') }} {{ page }}</span>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" :disabled="dirty || page <= 1" @click="go(page - 1)">{{
              t('previous')
            }}</Button
            ><Button
              size="sm"
              variant="outline"
              :disabled="dirty || page * 50 >= (result?.total ?? 0)"
              @click="go(page + 1)"
              >{{ t('next') }}</Button
            >
          </div>
        </div>
        <p class="help">{{ t('countHint') }}</p>
      </div>
      <div v-if="leaving" role="alert" class="grid gap-3 rounded-md border p-3">
        <p class="text-sm">{{ t('leaveHint') }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" @click="leaving = undefined">{{ t('keep') }}</Button
          ><Button variant="outline" @click="leave(leaving)">{{ t('discard') }}</Button>
        </div>
      </div>
    </DialogContent></Dialog
  >
</template>
<style scoped src="../catalog-management.css"></style>
