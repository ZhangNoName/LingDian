<script setup lang="ts" generic="Row extends object">
import { Refresh, Search } from '@element-plus/icons-vue'
import { computed, ref, useSlots, watch } from 'vue'
import AppIconButton from '../common/AppIconButton.vue'
import { columnKey, createResetPatch, formatCellValue } from './schema'
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
  'selection-change': [rows: Row[]]
}>()

const formatted = ref<Record<string, string>>({})
const slots = useSlots()
const visibleColumns = computed(() => props.columns.filter((column) => !column.hidden))
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
  const next: Record<string, string> = {}
  await Promise.all(props.data.flatMap((row, rowIndex) => visibleColumns.value.map(async (column) => {
    next[formattedKey(rowIndex, column)] = await formatCellValue(column, row, undefined, rowIndex)
  })))
  formatted.value = next
}

watch([() => props.data, () => props.columns], refreshFormattedValues, { immediate: true, deep: true })
</script>

<template>
  <div class="schema-table-page">
    <SchemaSearchForm
      v-if="hasSearchColumns"
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
        <AppIconButton :icon="Search" type="primary" data-testid="schema-search-submit" @click="emit('search')">搜索</AppIconButton>
        <AppIconButton :icon="Refresh" data-testid="schema-search-reset" @click="resetSearch">重置</AppIconButton>
      </div>
    </div>

    <el-alert
      v-if="error"
      class="schema-table-page__error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
    >
      <template #default><el-button link type="danger" @click="emit('retry')">重新加载</el-button></template>
    </el-alert>

    <div class="schema-table-page__table" data-scroll-owner="table">
      <el-table
        v-loading="loading"
        height="100%"
        :data="data"
        :row-key="rowKey"
        @selection-change="emit('selection-change', $event)"
      >
        <el-table-column
          v-for="column in visibleColumns"
          :key="columnKey(column)"
          :prop="column.dataIndex"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :show-overflow-tooltip="column.showOverflowTooltip"
        >
          <template #default="scope">
            <slot
              v-if="column.slot && $slots[`cell-${column.slot}`]"
              :name="`cell-${column.slot}`"
              :row="scope.row"
              :column="column"
              :index="scope.$index"
            />
            <slot
              v-else-if="$slots[`cell-${columnKey(column)}`]"
              :name="`cell-${columnKey(column)}`"
              :row="scope.row"
              :column="column"
              :index="scope.$index"
            />
            <span v-else>{{ formatted[formattedKey(scope.$index, column)] ?? '—' }}</span>
          </template>
        </el-table-column>
        <template #empty>
          <slot name="empty"><el-empty :description="emptyText" /></slot>
        </template>
      </el-table>
    </div>

    <footer class="schema-table-page__pagination">
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="pagination.pageSizes ?? [10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @update:current-page="emit('page-change', $event)"
        @update:page-size="emit('page-size-change', $event)"
      />
    </footer>
  </div>
</template>
