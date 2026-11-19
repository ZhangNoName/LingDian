<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationNext, PaginationPrevious } from '@lingdian/console-ui/pagination'
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
function changePage(value: number) {
  const page = Number.isFinite(value) ? Math.max(1, Math.min(pageCount.value, Math.trunc(value))) : props.pagination.page
  pageDraft.value = page
  if (page !== props.pagination.page) emit('page-change', page)
}
</script>

<template>
  <Pagination :page="pagination.page" :total="pagination.total" :items-per-page="pagination.pageSize" show-edges :sibling-count="2" @update:page="changePage" class="flex flex-wrap items-center justify-end gap-2 text-sm" aria-label="分页">
    <span>共 {{ pagination.total }} 条</span>
    <SelectField
      :model-value="pagination.pageSize"
      aria-label="每页条数"
      :options="pageSizes"
      @update:model-value="emit('page-size-change', $event)"
    />
    <PaginationContent v-slot="{ items }" class="flex-wrap">
      <PaginationPrevious type="button" aria-label="上一页">上一页</PaginationPrevious>
      <template v-for="(item, index) in items" :key="item.type === 'page' ? item.value : `gap-${index}`">
        <PaginationItem v-if="item.type === 'page'" :value="item.value" :aria-label="`第 ${item.value} 页`" :is-active="item.value === pagination.page">
          {{ item.value }}
        </PaginationItem>
        <PaginationEllipsis v-else><span aria-hidden="true">…</span><span class="sr-only">更多页码</span></PaginationEllipsis>
      </template>
      <PaginationNext type="button" aria-label="下一页">下一页</PaginationNext>
    </PaginationContent>
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
  </Pagination>
</template>
