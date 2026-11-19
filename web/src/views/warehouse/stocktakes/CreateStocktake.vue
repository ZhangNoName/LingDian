<script setup lang="ts">
import TablePagination from '@/components/table/TablePagination.vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import type { InventoryItemContract, InventoryPage } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { Textarea } from '@lingdian/console-ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { listInventory } from '@/services/inventory'
import { createStocktake } from '@/services/stocktakes'
import { useStocktakeLocale, errorKey, type Key } from './locale'
const props = defineProps<{ open: boolean; storeId: string }>(),
  emit = defineEmits<{ 'update:open': [boolean]; saved: [string] }>(),
  { t } = useStocktakeLocale()
const title = ref(''),
  note = ref(''),
  keyword = ref(''),
  applied = ref(''),
  page = ref(1),
  pageSize = ref(50),
  result = ref<InventoryPage>(),
  selected = ref<InventoryItemContract[]>([]),
  loading = ref(false),
  saving = ref(false),
  error = ref<Key>()
let sequence = 0,
  requestId = '',
  disposed = false
function close(open: boolean) {
  if (!saving.value) emit('update:open', open)
}
async function load() {
  const current = ++sequence
  loading.value = true
  error.value = undefined
  try {
    const data = await listInventory(props.storeId, { page: page.value, pageSize: pageSize.value, keyword: applied.value })
    if (current === sequence) result.value = data
  } catch {
    if (current === sequence) error.value = 'failed'
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      title.value = ''
      note.value = ''
      keyword.value = ''
      applied.value = ''
      page.value = 1
      selected.value = []
      requestId = crypto.randomUUID()
      void load()
    } else sequence++
  },
)
function search() {
  applied.value = keyword.value.trim()
  page.value = 1
  void load()
}
function choose(item: InventoryItemContract) {
  if (selected.value.length < 50 && !selected.value.some((row) => row.id === item.id)) selected.value.push(item)
}
function go(next: number) {
  page.value = next
  void load()
}
async function submit() {
  if (saving.value || !selected.value.length) return
  saving.value = true
  error.value = undefined
  try {
    const row = await createStocktake(props.storeId, {
      requestId,
      title: title.value.trim(),
      note: note.value.trim(),
      itemIds: selected.value.map((row) => row.id),
    })
    if (!disposed) {
      emit('update:open', false)
      emit('saved', row.id)
    }
  } catch (e) {
    if (!disposed) error.value = errorKey(e)
  } finally {
    saving.value = false
  }
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <Dialog :open="open" @update:open="close"
    ><DialogContent class="max-h-[92dvh] max-w-2xl overflow-y-auto" :close-label="t('close')" :close-disabled="saving"
      ><DialogHeader
        ><DialogTitle>{{ t('new') }}</DialogTitle
        ><DialogDescription>{{ t('createHint') }}</DialogDescription></DialogHeader
      >
      <form class="grid min-w-0 gap-4" @submit.prevent="submit">
        <fieldset class="grid min-w-0 gap-4" :disabled="saving">
          <label>{{ t('name') }}<Input v-model="title" required maxlength="120" /></label
          ><label>{{ t('reason') }}<Textarea v-model="note" required maxlength="240" rows="2" /></label>
          <div class="flex items-end gap-2">
            <label class="grow"
              >{{ t('search')
              }}<Input v-model="keyword" type="search" maxlength="120" @keydown.enter.prevent="search" /></label
            ><Button type="button" variant="outline" :disabled="loading" @click="search">{{ t('find') }}</Button>
          </div>
          <p v-if="loading" role="status" class="help">{{ t('loading') }}</p>
          <ul v-else class="grid max-h-52 gap-2 overflow-y-auto border p-2">
            <li v-for="item in result?.items" :key="item.id" class="flex items-center justify-between gap-3 text-sm">
              <span class="min-w-0 break-words"
                >{{ item.name }} <span class="help">{{ item.code }} · {{ item.unit }}</span></span
              ><Button
                type="button"
                size="sm"
                variant="outline"
                :aria-label="`${t('add')} ${item.name}`"
                :disabled="selected.length >= 50 || selected.some((row) => row.id === item.id)"
                @click="choose(item)"
                >{{ t('add') }}</Button
              >
            </li>
          </ul>
          <div class="flex justify-end gap-2">
            <TablePagination
              :page="page"
              :page-size="pageSize"
              @update:page-size="pageSize = $event; go(1)"
              :pages="Math.ceil((result?.total ?? 0) / pageSize)"
              :disabled="loading"
              @update:page="go($event)"
            />
          </div>
          <p class="text-sm font-medium">{{ t('selected') }}: {{ selected.length }} / 50</p>
          <ul class="grid gap-2">
            <li v-for="item in selected" :key="item.id" class="flex items-center justify-between gap-2 text-sm">
              <span>{{ item.name }} · {{ item.unit }}</span
              ><Button
                type="button"
                size="sm"
                variant="ghost"
                :aria-label="`${t('remove')} ${item.name}`"
                @click="selected = selected.filter((row) => row.id !== item.id)"
                >{{ t('remove') }}</Button
              >
            </li>
          </ul>
        </fieldset>
        <p v-if="error" role="alert" class="error">{{ t(error) }}</p>
        <div class="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" :disabled="saving" @click="close(false)">{{ t('cancel') }}</Button
          ><Button :disabled="saving || !selected.length">{{ t(saving ? 'saving' : 'create') }}</Button>
        </div>
      </form>
    </DialogContent></Dialog
  >
</template>
<style scoped src="../purchasing/purchasing.css"></style>
