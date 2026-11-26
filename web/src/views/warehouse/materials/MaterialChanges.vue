<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import ListToolbar from '@/components/table/ListToolbar.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import type { InventoryMaterialChangeKind, InventoryMaterialChangePage } from '@lingdian/contracts'
import { SearchSelectField } from '@lingdian/console-ui/select'
import { useLocale } from '@/i18n/locale'
import { inventoryMaterialChanges } from '@/services/inventory'
import { downloadCsv } from '../report'
import { useMaterialProfileLocale } from './profile-locale'
const props = defineProps<{
    storeId: string
    storeName: string
    itemId: string
    kind: InventoryMaterialChangeKind | 'ALL'
    page: number
    revision: number
  }>(),
  emit = defineEmits<{ change: [kind: InventoryMaterialChangeKind | 'ALL', page: number] }>()
const { locale } = useLocale(),
  { t } = useMaterialProfileLocale()
const result = ref<InventoryMaterialChangePage>(),
  pageSize = ref(20),
  loading = ref(true),
  failed = ref(false)
const kinds = ['ALL', 'NAME', 'ARCHIVE', 'RESTORE'] as const
const date = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const state = (value: boolean | null) => (value === null ? '' : t(value ? 'active' : 'archived'))
let sequence = 0
async function load() {
  const token = ++sequence
  loading.value = true
  failed.value = false
  try {
    const data = await inventoryMaterialChanges(props.storeId, props.itemId, props.kind, props.page, pageSize.value)
    if (
      data.storeId !== props.storeId ||
      data.item.id !== props.itemId ||
      data.item.storeId !== props.storeId
    )
      throw Error('inventory.notFound')
    if (token === sequence) {
      result.value = data
      if (data.page !== props.page) emit('change', props.kind, data.page)
    }
  } catch {
    if (token === sequence) failed.value = true
  } finally {
    if (token === sequence) loading.value = false
  }
}
watch(
  [() => props.storeId, () => props.itemId, () => props.kind, () => props.page, pageSize, () => props.revision],
  load,
  { immediate: true },
)
function exportPage() {
  if (!result.value || loading.value || failed.value) return
  const snapshot = result.value,
    rows: (string | number)[][] = [
      [t('store'), props.storeName, snapshot.storeId],
      [t('material'), snapshot.item.id, snapshot.item.code, snapshot.item.name],
      [t('snapshot'), snapshot.generatedAt],
      [t('kind'), t(snapshot.kind), t('page'), snapshot.page, t('records'), snapshot.total],
      [t('exportHint')],
      [t('identifier'), t('kind'), t('before'), t('after'), t('actor'), t('reason'), t('at')],
    ]
  for (const row of snapshot.items)
    rows.push([
      row.id,
      t(row.kind),
      row.kind === 'NAME' ? (row.nameBefore ?? '') : state(row.isActiveBefore),
      row.kind === 'NAME' ? (row.nameAfter ?? '') : state(row.isActiveAfter),
      row.actorId ?? '',
      row.reason,
      row.createdAt,
    ])
  downloadCsv(`material-changes-${snapshot.kind.toLowerCase()}-p${snapshot.page}.csv`, rows)
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <section class="grid min-w-0 gap-3 border-y py-3" :aria-label="t('history')">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <label class="grid gap-1 text-xs text-muted-foreground"
        >{{ t('filter')
        }}<SearchSelectField
          :model-value="kind"
          :aria-label="t('filter')"
          :disabled="loading"
          @update:model-value="$emit('change', $event, 1)"
          :options="kinds.map((value) => ({ value, label: t(value) }))"
        /></label>
    </div>
    <ListToolbar>
      <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading" @click="load" />
    </ListToolbar>
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="failed" role="alert" class="grid justify-items-start gap-2 text-sm text-destructive">
      <p>{{ t('historyFailure') }}</p>
      <DataActionButton action="refresh" :label="t('refresh')" size="icon-sm" @click="load" />
    </div>
    <template v-else-if="result"
      ><p v-if="!result.items.length" class="py-2 text-sm text-muted-foreground">{{ t('empty') }}</p>
      <ol v-else class="grid gap-3">
        <li
          v-for="row in result.items"
          :key="row.id"
          class="grid min-w-0 gap-2 border p-3 text-sm"
        >
          <div class="flex flex-wrap justify-between gap-2">
            <strong>{{ t(row.kind) }}</strong
            ><time class="text-xs text-muted-foreground" :datetime="row.createdAt">{{
              date(row.createdAt)
            }}</time>
          </div>
          <p v-if="row.kind === 'NAME'" class="break-words">
            {{ row.nameBefore ?? '—' }} → {{ row.nameAfter ?? '—' }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            {{ state(row.isActiveBefore) || '—' }} → {{ state(row.isActiveAfter) || '—' }}
          </p>
          <p class="whitespace-pre-wrap break-words">{{ row.reason }}</p>
          <p class="break-all text-xs text-muted-foreground">{{ t('actor') }}: {{ row.actorId ?? '—' }}</p>
        </li>
      </ol>
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span
          >{{ result.total.toLocaleString(locale) }} {{ t('records') }}</span
        >
        <div class="flex gap-2">
          <TablePagination
            :page="result.page"
            :page-size="pageSize"
            @update:page-size="pageSize = $event; $emit('change', kind, 1)"
            :pages="Math.ceil(result.total / result.pageSize)"
            @update:page="$emit('change', kind, $event)"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{{ t('snapshot') }}: {{ date(result.generatedAt) }}</span>
        <DataActionButton action="export" :label="t('export')" size="icon-sm" :disabled="!result.items.length" @click="exportPage" />
      </div>
    </template>
  </section>
</template>
