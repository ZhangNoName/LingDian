<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import ListToolbar from '@/components/table/ListToolbar.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import TableAction from '@/components/table/TableAction.vue'
import { Pencil } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CategoryContract, MerchantCategoryPage, MerchantCategoryRecord } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { Table } from '@lingdian/console-ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
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
  pageSize = ref(50),
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
    const data = await merchantCategories(props.storeId, applied.value, '', page.value, pageSize.value)
    if (current === sequence) {
      result.value = data
      const last = Math.max(1, Math.ceil(data.total / pageSize.value))
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
function reset() {
  keyword.value = ''
  search()
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
    ><DialogContent class="max-h-[92dvh] max-w-3xl overflow-y-auto" :close-label="t('close')" :close-disabled="busy" :aria-describedby="undefined"
      ><DialogHeader
        ><DialogTitle>{{ t(editing ? (selected ? 'edit' : 'new') : 'title') }}</DialogTitle></DialogHeader
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
        <form id="category-filters" class="flex items-end gap-2" @submit.prevent="search">
          <label class="grid min-w-0 grow gap-1 text-xs text-muted-foreground"
            >{{ t('search')
            }}<Input
              v-model="keyword"
              type="search"
              maxlength="120" /></label
          >
        </form>
        <ListToolbar>
          <template #left><Button @click="edit()">{{ t('new') }}</Button></template>
          <DataActionButton action="refresh" :label="t('reload')" :disabled="loading || dirty" @click="load" />
          <Button type="submit" form="category-filters" variant="outline" :disabled="loading">{{ t('find') }}</Button>
          <Button type="button" variant="ghost" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
        </ListToolbar>
        <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
        <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
        <p v-if="loading" role="status" class="help">{{ t('loading') }}</p>
        <div v-else-if="failed" role="alert">
          <p>{{ t('failed') }}</p>
          <DataActionButton action="refresh" :label="t('reload')" @click="load" />
        </div>
        <p v-else-if="!result?.total" class="help py-6 text-center">{{ t('empty') }}</p>
        <template v-else>
          <Table framed tabindex="0" container-class="hidden sm:block" :aria-label="t('title')" class="border-collapse text-start">
            <thead><tr><th scope="col">{{ t('name') }}</th><th scope="col">{{ t('visible') }}</th><th scope="col">{{ t('sort') }}</th><th scope="col">{{ t('products') }}</th><th scope="col">{{ t('active') }}</th><th scope="col">{{ t('edit') }}</th></tr></thead>
            <tbody>
              <tr v-for="row in result.items" :key="row.id">
                <th scope="row" class="min-w-28 break-words font-medium">{{ row.name }}</th>
                <td>{{ t(row.is_visible ? 'shown' : 'hidden') }}</td>
                <td class="tabular-nums">{{ number(row.sort_order) }}</td>
                <td class="tabular-nums">{{ number(row.product_count) }}</td>
                <td class="tabular-nums">{{ number(row.active_product_count) }}</td>
                <td><TableAction :icon="Pencil" :label="t('edit')" :aria-label="`${t('edit')} ${row.name}`" @click="edit(row)" /></td>
              </tr>
            </tbody>
          </Table>
          <ul class="table-scroll grid gap-3 sm:hidden">
            <li v-for="row in result.items" :key="row.id" class="grid min-w-0 gap-3 border p-3 text-sm">
              <div class="flex items-start justify-between gap-2">
                <strong class="min-w-0 break-words">{{ row.name }}</strong
                ><span class="shrink-0 text-xs text-muted-foreground">{{ t(row.is_visible ? 'shown' : 'hidden') }}</span>
              </div>
              <p class="help">
                {{ t('sort') }}: {{ number(row.sort_order) }} · {{ t('products') }} {{ number(row.product_count) }} ·
                {{ t('active') }} {{ number(row.active_product_count) }}
              </p>
              <TableAction :icon="Pencil" :label="t('edit')"
                class="justify-self-end"
                :aria-label="`${t('edit')} ${row.name}`"
                @click="edit(row)" />
            </li>
          </ul>
        </template>
        <div v-if="!loading && !failed" class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{{ number(result?.total ?? 0) }} {{ t('total') }}</span>
          <div class="flex gap-2">
            <TablePagination
              :page="page"
              :page-size="pageSize"
              @update:page-size="pageSize = $event; go(1)"
              :pages="Math.ceil((result?.total ?? 0) / pageSize)"
              :disabled="dirty"
              @update:page="go($event)"
            />
          </div>
        </div>
        <p class="help">{{ t('countHint') }}</p>
      </div>
      <div v-if="leaving" role="alert" class="grid gap-3 border p-3">
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
