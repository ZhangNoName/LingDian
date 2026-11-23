<script setup lang="ts" generic="Row extends object">
import { Alert } from '@lingdian/console-ui/alert'
import { Button } from '@lingdian/console-ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@lingdian/console-ui/table'
import { Refresh, Search } from '@lingdian/icons/admin'
import { computed, ref, useId, useSlots, watch } from 'vue'
import { columnKey, createResetPatch, formatCellValue, getByDataIndex } from './schema'
import SchemaPaginationControls from './SchemaPagination.vue'
import SchemaSearchForm from './SchemaSearchForm.vue'
import type { QueryRecord, SchemaColumn, SchemaPagination } from './types'

const props = withDefaults(defineProps<{
  columns: readonly SchemaColumn<Row>[]
  query: QueryRecord
  data: readonly Row[]
  pagination: SchemaPagination
  loading?: boolean
  error?: string
  rowKey?: string | ((row: Row) => string)
  emptyText?: string
  searchable?: boolean
}>(), {
  loading: false,
  error: '',
  rowKey: undefined,
  emptyText: '暂无符合条件的数据',
  searchable: true,
})

const emit = defineEmits<{
  'update:query': [value: QueryRecord]
  search: []
  reset: []
  retry: []
  'page-change': [page: number]
  'page-size-change': [pageSize: number]
}>()

const formatted = ref<Record<string, string>>({})
const slots = useSlots()
const filterFormId = useId()
let formattingSequence = 0
const visibleColumns = computed(() => props.columns.filter((column) => !column.hidden))
const minimumTableWidth = computed(() => visibleColumns.value.reduce((width, column) => width + columnWidth(column), 0))

function columnWidth(column: SchemaColumn<Row>): number {
  const configured = column.width ?? column.minWidth
  if (typeof configured === 'number') return configured
  return configured && /^\d+(?:\.\d+)?(?:px)?$/.test(configured) ? parseFloat(configured) : 120
}

function fixedSide(column: SchemaColumn<Row>) {
  return column.fixed === true ? 'left' : column.fixed || undefined
}

function fixedOffset(column: SchemaColumn<Row>) {
  const side = fixedSide(column)
  if (!side) return undefined
  const index = visibleColumns.value.indexOf(column)
  const others = side === 'left' ? visibleColumns.value.slice(0, index) : visibleColumns.value.slice(index + 1)
  const offset = others.filter((item) => fixedSide(item) === side).reduce((width, item) => width + columnWidth(item), 0)
  return { [side]: `${offset}px` }
}

function rowId(row: Row, index: number) {
  return typeof props.rowKey === 'function'
    ? props.rowKey(row)
    : String(getByDataIndex(row, props.rowKey) ?? index)
}
const hasSearchColumns = computed(() => props.searchable && props.columns.some((column) => column.isSearch))
const hasToolbarActions = computed(() => Boolean(slots['toolbar-actions'] || slots.toolbar))

function resetSearch(): void {
  emit('update:query', { ...props.query, ...createResetPatch(props.columns) })
  emit('reset')
}

function formattedKey(rowIndex: number, column: SchemaColumn<Row>): string {
  return `${rowIndex}:${columnKey(column)}`
}

async function refreshFormattedValues(): Promise<void> {
  const sequence = ++formattingSequence
  const next: Record<string, string> = {}
  await Promise.all(props.data.flatMap((row, rowIndex) => visibleColumns.value.map(async (column) => {
    next[formattedKey(rowIndex, column)] = await formatCellValue(column, row, undefined, rowIndex)
  })))
  if (sequence === formattingSequence) formatted.value = next
}

watch([() => props.data, () => props.columns], refreshFormattedValues, { immediate: true, deep: true })
</script>

<template>
  <div class="schema-table-page">
    <SchemaSearchForm
      v-if="hasSearchColumns"
      :form-id="filterFormId"
      :columns="columns"
      :query="query"
      @update:query="emit('update:query', $event)"
      @search="emit('search')"
    >
      <template v-for="column in columns" #[`search-${columnKey(column)}`]="slotProps">
        <slot
          v-if="$slots[`search-${columnKey(column)}`]"
          :name="`search-${columnKey(column)}`"
          v-bind="slotProps ?? {}"
        />
      </template>
    </SchemaSearchForm>

    <div v-if="hasSearchColumns || hasToolbarActions" class="schema-table-page__toolbar">
      <div v-if="hasToolbarActions" class="schema-table-page__toolbar-left">
        <slot v-if="$slots['toolbar-actions']" name="toolbar-actions" />
        <slot v-else name="toolbar" />
      </div>
      <div v-if="hasSearchColumns" class="schema-table-page__toolbar-right">
        <Button type="submit" :form="filterFormId" data-testid="schema-search-submit"><Search aria-hidden="true" />搜索</Button>
        <Button type="button" variant="outline" data-testid="schema-search-reset" @click="resetSearch"><Refresh aria-hidden="true" />重置</Button>
      </div>
    </div>

    <Alert v-if="error" class="schema-table-page__error">
      {{ error }}
      <Button type="button" variant="link" @click="emit('retry')">重新加载</Button>
    </Alert>

    <div class="schema-table-page__table" data-scroll-owner="table" :aria-busy="loading">
      <Table
        class="schema-data-table"
        container-class="schema-data-table__scroll"
        :table-style="{ minWidth: `${minimumTableWidth}px` }"
      >
        <colgroup>
          <col v-for="column in visibleColumns" :key="columnKey(column)" :style="{ width: column.width ? `${columnWidth(column)}px` : undefined }" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead
              v-for="column in visibleColumns"
              :key="columnKey(column)"
              scope="col"
              :data-fixed="fixedSide(column)"
              :style="{ ...fixedOffset(column), textAlign: column.align }"
            >
              {{ column.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in data" :key="rowId(row, index)">
            <TableCell
              v-for="column in visibleColumns"
              :key="columnKey(column)"
              :data-fixed="fixedSide(column)"
              :style="{ ...fixedOffset(column), textAlign: column.align }"
            >
              <slot
                v-if="column.slot && $slots[`cell-${column.slot}`]"
                :name="`cell-${column.slot}`"
                :row="row"
                :column="column"
                :index="index"
              />
              <slot
                v-else-if="$slots[`cell-${columnKey(column)}`]"
                :name="`cell-${columnKey(column)}`"
                :row="row"
                :column="column"
                :index="index"
              />
              <span
                v-else
                :class="{ 'block truncate': column.showOverflowTooltip }"
                :title="column.showOverflowTooltip ? formatted[formattedKey(index, column)] : undefined"
              >
                {{ formatted[formattedKey(index, column)] ?? '—' }}
              </span>
            </TableCell>
          </TableRow>
          <TableRow v-if="!data.length && !loading">
            <TableCell :colspan="Math.max(1, visibleColumns.length)" class="h-28 text-center text-muted-foreground">
              <slot name="empty">{{ emptyText }}</slot>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div v-if="loading" class="schema-data-table__loading" role="status">正在加载…</div>
    </div>

    <footer class="schema-table-page__pagination">
      <SchemaPaginationControls
        :pagination="pagination"
        @page-change="emit('page-change', $event)"
        @page-size-change="emit('page-size-change', $event)"
      />
    </footer>
  </div>
</template>
