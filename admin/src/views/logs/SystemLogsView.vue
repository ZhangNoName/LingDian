<script setup lang="ts">
import type { SystemLogPage, SystemLogQuery, SystemLogRecord } from '@lingdian/contracts'
import { View } from '@lingdian/icons/admin'
import { computed, onMounted, reactive, ref } from 'vue'
import {
  SchemaTableActions,
  SchemaTablePage,
  type QueryRecord,
  type SchemaAction,
} from '../../components/schema-table'
import { getSystemLogs } from '../../services/system-logs'
import LogDetailDrawer from './LogDetailDrawer.vue'
import { createLogColumns } from './log-columns'

const query = reactive<SystemLogQuery>({ page: 1, pageSize: 20 })
const result = ref<SystemLogPage>({ items: [], total: 0, page: 1, pageSize: 20 })
const loading = ref(false)
const error = ref('')
const selected = ref<SystemLogRecord>()
const drawer = ref(false)
let loadSequence = 0
const columns = createLogColumns()
const schemaQuery = computed<QueryRecord>({
  get: () => ({ ...query }),
  set: (value) => Object.assign(query, value),
})
const pagination = computed(() => ({
  page: query.page,
  pageSize: query.pageSize,
  total: result.value.total,
}))

async function load() {
  const sequence = ++loadSequence
  loading.value = true
  error.value = ''
  try {
    const page = await getSystemLogs(query)
    if (sequence === loadSequence) result.value = page
  } catch (cause) {
    if (sequence === loadSequence) error.value = cause instanceof Error ? cause.message : '日志加载失败'
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

function resetFilters() {
  Object.assign(query, { source: undefined, level: undefined, from: undefined, to: undefined, page: 1 })
  void load()
}

function changePage(page: number) {
  query.page = page
  void load()
}

function changePageSize(pageSize: number) {
  query.pageSize = pageSize
  query.page = 1
  void load()
}

function details(row: SystemLogRecord) {
  selected.value = row
  drawer.value = true
}

function rowActions(): SchemaAction<SystemLogRecord>[] {
  return [{ key: 'details', label: '查看详情', icon: View, onClick: details }]
}

onMounted(load)
</script>

<template>
  <div class="list-page">
    <SchemaTablePage
      v-model:query="schemaQuery"
      :columns="columns"
      :data="result.items"
      :pagination="pagination"
      :loading="loading"
      :error="error"
      row-key="id"
      empty-text="暂无符合条件的日志"
      @search="search"
      @reset="resetFilters"
      @retry="load"
      @page-change="changePage"
      @page-size-change="changePageSize"
    >
      <template #toolbar-actions><el-button :loading="loading" @click="load">刷新</el-button></template>
      <template #cell-level="{ row }">
        <el-tag :type="row.level === 'ERROR' || row.level === 'FATAL' ? 'danger' : row.level === 'WARN' ? 'warning' : 'success'">
          {{ row.level }}
        </el-tag>
      </template>
      <template #cell-actions="{ row }">
        <SchemaTableActions :row="row" :actions="rowActions()" />
      </template>
    </SchemaTablePage>

    <LogDetailDrawer v-model="drawer" :log="selected" />
  </div>
</template>
