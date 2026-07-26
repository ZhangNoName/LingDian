<script setup lang="ts" generic="Row extends object">
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { dictionaryRegistry, type DictionaryOption } from '../../dictionaries'
import { columnKey } from './schema'
import type { QueryRecord, SchemaColumn } from './types'

const props = withDefaults(defineProps<{
  columns: readonly SchemaColumn<Row>[]
  query: QueryRecord
  defaultExpanded?: boolean
}>(), { defaultExpanded: true })
const emit = defineEmits<{
  'update:query': [value: QueryRecord]
  search: []
}>()

const expanded = ref(props.defaultExpanded)
const options = ref<Record<string, readonly DictionaryOption[]>>({})
const searchColumns = computed(() => props.columns
  .filter((column) => column.isSearch)
  .sort((left, right) => (left.searchOrder ?? 0) - (right.searchOrder ?? 0)))

function queryKey(column: SchemaColumn<Row>): string {
  return column.queryKey ?? column.dataIndex ?? columnKey(column)
}

function updateField(column: SchemaColumn<Row>, value: unknown): void {
  emit('update:query', { ...props.query, [queryKey(column)]: value })
}

async function loadOptions(): Promise<void> {
  const resolved: Record<string, readonly DictionaryOption[]> = {}
  await Promise.all(searchColumns.value.map(async (column) => {
    const key = columnKey(column)
    if (column.options) {
      resolved[key] = await Promise.resolve(typeof column.options === 'function' ? column.options() : column.options)
    } else if (column.dictionaryCode) {
      resolved[key] = await dictionaryRegistry.getOptions(column.dictionaryCode)
    }
  }))
  options.value = resolved
}

onMounted(loadOptions)
watch(() => props.columns, loadOptions)
</script>

<template>
  <section class="schema-search" :class="{ 'is-collapsed': !expanded }">
    <div class="schema-search__heading">
      <strong>筛选条件</strong>
      <el-button
        text
        type="primary"
        data-testid="schema-search-collapse"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <el-icon><ArrowUp v-if="expanded" /><ArrowDown v-else /></el-icon>
        {{ expanded ? '收起' : '展开' }}
      </el-button>
    </div>
    <el-form v-show="expanded" class="schema-search__form" @submit.prevent="emit('search')">
      <el-form-item v-for="column in searchColumns" :key="columnKey(column)" :label="column.label">
        <slot
          :name="`search-${columnKey(column)}`"
          :column="column"
          :value="query[queryKey(column)]"
          :update="(value: unknown) => updateField(column, value)"
        >
          <el-select
            v-if="column.searchType === 'select'"
            :model-value="query[queryKey(column)]"
            :placeholder="column.placeholder ?? `请选择${column.label}`"
            :clearable="column.clearable !== false"
            :filterable="column.filterable"
            @update:model-value="updateField(column, $event)"
          >
            <el-option
              v-for="option in options[columnKey(column)] ?? []"
              :key="String(option.value)"
              :label="option.fallbackLabel"
              :value="option.value"
              :disabled="option.disabled"
            />
          </el-select>
          <el-date-picker
            v-else-if="column.searchType === 'date' || column.searchType === 'dateRange'"
            :model-value="query[queryKey(column)]"
            :type="column.searchType === 'dateRange' ? 'daterange' : 'date'"
            :placeholder="column.placeholder ?? `请选择${column.label}`"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @update:model-value="updateField(column, $event)"
          />
          <el-input
            v-else
            :model-value="query[queryKey(column)]"
            :placeholder="column.placeholder ?? `请输入${column.label}`"
            :clearable="column.clearable !== false"
            @update:model-value="updateField(column, $event)"
          />
        </slot>
      </el-form-item>
    </el-form>
  </section>
</template>
