<script setup lang="ts">
import { computed } from 'vue'
import { PaginationControls } from '@lingdian/console-ui/pagination'
import { SelectField } from '@lingdian/console-ui/select'
import { useLocale } from '@/i18n/locale'
import { tablePageSizes } from './page-size'

const props = defineProps<{ page: number; pages: number; pageSize: number; pageSizes?: readonly number[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:page': [page: number]; 'update:pageSize': [pageSize: number] }>()
const { locale } = useLocale()
const sizes = computed(() => (props.pageSizes ?? tablePageSizes).map((size) => ({ value: size, label: String(size) })))
const labels = computed(() => {
  const pages = Math.max(1, props.pages)
  return locale.value === 'en-US'
    ? { pagination: 'Pagination', size: 'Rows per page', first: 'First page', previous: 'Previous', next: 'Next', last: 'Last page', jump: 'Go to page', status: `Page ${props.page} of ${pages}` }
    : { pagination: '分页', size: '每页条数', first: '第一页', previous: '上一页', next: '下一页', last: '最后一页', jump: '跳转页码', status: `第 ${props.page} / ${pages} 页` }
})
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2">
    <div class="flex items-center gap-2 text-sm text-foreground">
      <span>{{ labels.size }}</span>
      <SelectField :model-value="pageSize" :options="sizes" :disabled="disabled" :aria-label="labels.size" @update:model-value="emit('update:pageSize', $event)" />
    </div>
    <PaginationControls :page="page" :pages="pages" :disabled="disabled" :labels="labels" @update:page="emit('update:page', $event)" />
  </div>
</template>
