<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import type { SchemaPagination } from './types'

const props = defineProps<{ pagination: SchemaPagination }>()
const emit = defineEmits<{ 'page-change': [page: number]; 'page-size-change': [pageSize: number] }>()
const pageCount = computed(() => Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize)))
const pageSizes = computed(() => (props.pagination.pageSizes ?? [10, 20, 50, 100])
  .map((size) => ({ value: size, label: `${size} 条/页` })))
const pageDraft = ref(props.pagination.page)
watch(() => props.pagination.page, (page) => { pageDraft.value = page })
const pageLinks = computed(() => {
  const last = pageCount.value
  const start = Math.max(2, Math.min(props.pagination.page - 2, last - 5))
  const end = Math.min(last - 1, start + 4)
  if (last === 1) return [1]
  return [
    1,
    ...(start > 2 ? ['before'] : []),
    ...Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index),
    ...(end < last - 1 ? ['after'] : []),
    last,
  ]
})

function changePage(value: number) {
  const page = Number.isFinite(value) ? Math.max(1, Math.min(pageCount.value, Math.trunc(value))) : props.pagination.page
  pageDraft.value = page
  if (page !== props.pagination.page) emit('page-change', page)
}
</script>

<template>
  <nav class="flex flex-wrap items-center justify-end gap-2 text-sm" aria-label="分页">
    <span>共 {{ pagination.total }} 条</span>
    <SelectField
      :model-value="pagination.pageSize"
      aria-label="每页条数"
      :options="pageSizes"
      @update:model-value="emit('page-size-change', $event)"
    />
    <Button type="button" variant="outline" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">上一页</Button>
    <template v-for="page in pageLinks" :key="page">
      <span v-if="typeof page === 'string'" aria-hidden="true">…</span>
      <Button v-else type="button" :variant="pagination.page === page ? 'default' : 'outline'" size="icon" :aria-current="pagination.page === page ? 'page' : undefined" @click="changePage(page)">
        {{ page }}
      </Button>
    </template>
    <Button type="button" variant="outline" :disabled="pagination.page >= pageCount" @click="changePage(pagination.page + 1)">下一页</Button>
    <label class="flex items-center gap-1">
      前往
      <Input
        :model-value="pageDraft"
        type="number"
        min="1"
        :max="pageCount"
        aria-label="前往页码"
        class="w-18"
        @update:model-value="pageDraft = Number($event)"
        @keydown.enter.prevent="changePage(pageDraft)"
        @change="changePage(pageDraft)"
      />
      页
    </label>
  </nav>
</template>
