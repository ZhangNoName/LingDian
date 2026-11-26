<script setup lang="ts" generic="Row extends object">
import { ComboboxField } from '@lingdian/console-ui/combobox'
import { Input } from '@lingdian/console-ui/input'
import { SearchSelectField } from '@lingdian/console-ui/select'
import { ArrowDown, ArrowUp } from '@lingdian/icons/admin'
import { computed, onMounted, ref, watch } from 'vue'
import { Button } from '@lingdian/console-ui/button'
import { DatePicker } from '@lingdian/console-ui/date-picker'
import { dictionaryRegistry, type DictionaryOption } from '../../dictionaries'
import { columnKey } from './schema'
import type { QueryRecord, SchemaColumn } from './types'

const props = withDefaults(defineProps<{
  columns: readonly SchemaColumn<Row>[]
  query: QueryRecord
  formId?: string
  defaultExpanded?: boolean
}>(), { defaultExpanded: true })
const emit = defineEmits<{
  'update:query': [value: QueryRecord]
  search: []
}>()

const expanded = ref(props.defaultExpanded)
const options = ref<Record<string, readonly DictionaryOption[]>>({})
let optionsSequence = 0
const searchColumns = computed(() => props.columns
  .filter((column) => column.isSearch)
  .sort((left, right) => (left.searchOrder ?? 0) - (right.searchOrder ?? 0)))

function queryKey(column: SchemaColumn<Row>): string {
  return column.queryKey ?? column.dataIndex ?? columnKey(column)
}

function updateField(column: SchemaColumn<Row>, value: unknown): void {
  emit('update:query', { ...props.query, [queryKey(column)]: value })
}

function choices(column: SchemaColumn<Row>) {
  return (options.value[columnKey(column)] ?? []).map((option) => ({
    value: JSON.stringify(option.value),
    label: option.fallbackLabel,
    disabled: option.disabled,
  }))
}

function updateChoice(column: SchemaColumn<Row>, key: string | string[] | null) {
  const option = options.value[columnKey(column)]?.find((option) => JSON.stringify(option.value) === key)
  updateField(column, option?.value)
}

function inputValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function dateValue(value: unknown): string {
  if (value instanceof Date) {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
  }
  return inputValue(value)
}

function dateRange(column: SchemaColumn<Row>): [string, string] {
  const value = props.query[queryKey(column)]
  return Array.isArray(value) ? [dateValue(value[0]), dateValue(value[1])] : ['', '']
}

function updateDateRange(column: SchemaColumn<Row>, index: 0 | 1, value: string | number) {
  const range = dateRange(column)
  range[index] = String(value)
  updateField(column, range.some(Boolean) ? range : undefined)
}

async function loadOptions(): Promise<void> {
  const sequence = ++optionsSequence
  const resolved: Record<string, readonly DictionaryOption[]> = {}
  await Promise.all(searchColumns.value.map(async (column) => {
    const key = columnKey(column)
    if (column.options) {
      resolved[key] = await Promise.resolve(typeof column.options === 'function' ? column.options() : column.options)
    } else if (column.dictionaryCode) {
      resolved[key] = await dictionaryRegistry.getOptions(column.dictionaryCode)
    }
  }))
  if (sequence === optionsSequence) options.value = resolved
}

onMounted(loadOptions)
watch(() => props.columns, loadOptions)
</script>

<template>
  <section class="schema-search" :class="{ 'is-collapsed': !expanded }">
    <div class="schema-search__heading">
      <strong>筛选条件</strong>
      <Button
        type="button"
        variant="ghost"
        data-testid="schema-search-collapse"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <component :is="expanded ? ArrowUp : ArrowDown" aria-hidden="true" />
        {{ expanded ? '收起' : '展开' }}
      </Button>
    </div>
    <form :id="formId" v-show="expanded" class="schema-search__form" @invalid.capture="expanded = true" @submit.prevent="emit('search')">
      <div v-for="column in searchColumns" :key="columnKey(column)" class="grid min-w-0 gap-1.5">
        <span v-if="column.searchType !== 'date'" :id="`schema-label-${columnKey(column)}`" class="text-sm">{{ column.label }}</span>
        <slot
          :name="`search-${columnKey(column)}`"
          :column="column"
          :value="query[queryKey(column)]"
          :update="(value: unknown) => updateField(column, value)"
        >
          <ComboboxField
            v-if="column.searchType === 'select' && column.filterable"
            :model-value="JSON.stringify(query[queryKey(column)]) ?? null"
            :label="column.label"
            :placeholder="column.placeholder ?? `请选择${column.label}`"
            :clearable="column.clearable !== false"
            :options="choices(column)"
            @update:model-value="updateChoice(column, $event)"
          />
          <SearchSelectField
            v-else-if="column.searchType === 'select'"
            :model-value="JSON.stringify(query[queryKey(column)]) ?? ''"
            :aria-labelledby="`schema-label-${columnKey(column)}`"
            :placeholder="column.placeholder ?? `请选择${column.label}`"
            :options="column.clearable === false ? choices(column) : [
              { value: '', label: column.placeholder ?? `请选择${column.label}` },
              ...choices(column),
            ]"
            @update:model-value="updateChoice(column, $event)"
          />
          <div v-else-if="column.searchType === 'dateRange'" class="flex min-w-0 flex-wrap gap-2" role="group" :aria-labelledby="`schema-label-${columnKey(column)}`">
            <DatePicker label="开始日期" :model-value="dateRange(column)[0]" :max="dateRange(column)[1] || undefined" @update:model-value="updateDateRange(column, 0, $event)" />
            <DatePicker label="结束日期" :model-value="dateRange(column)[1]" :min="dateRange(column)[0] || undefined" @update:model-value="updateDateRange(column, 1, $event)" />
          </div>
          <DatePicker
            v-else-if="column.searchType === 'date'"
            :label="column.label"
            :model-value="dateValue(query[queryKey(column)])"
            @update:model-value="updateField(column, $event || undefined)"
          />
          <Input
            v-else
            :type="column.clearable === false ? 'text' : 'search'"
            :model-value="inputValue(query[queryKey(column)])"
            :aria-labelledby="`schema-label-${columnKey(column)}`"
            :placeholder="column.placeholder ?? `请输入${column.label}`"
            @update:model-value="updateField(column, $event || undefined)"
          />
        </slot>
      </div>
    </form>
  </section>
</template>
