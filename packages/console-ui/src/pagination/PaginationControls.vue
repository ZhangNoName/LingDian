<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PaginationFirst, PaginationLast, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ChevronLeftIcon, ChevronRight, ChevronsLeft, ChevronsRight } from '@lingdian/icons/web'
import { Button, buttonVariants } from '../button'
import { Input } from '../input'
import Pagination from './Pagination.vue'
import PaginationContent from './PaginationContent.vue'
import PaginationNext from './PaginationNext.vue'
import PaginationPrevious from './PaginationPrevious.vue'

const props = defineProps<{
  page: number
  pages: number
  labels: { pagination: string; first: string; previous: string; next: string; last: string; jump: string; status: string }
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const pageCount = computed(() => Math.max(1, props.pages))
const arrowStyle = `${buttonVariants({ variant: 'outline', size: 'icon-sm' })} px-0 sm:pr-0`
const jumpOpen = ref(false)
const jumpPage = ref<string | number>('')
const jumpTrigger = ref<InstanceType<typeof Button>>()
const jumpInput = ref<InstanceType<typeof Input>>()
// Keep the page input inside the enclosing modal's focus trap.
const jumpPortal = computed(() => (jumpTrigger.value?.$el as HTMLElement | undefined)?.closest<HTMLElement>('[role="dialog"]') ?? undefined)

function toggleJump(open: boolean) {
  if (open) jumpPage.value = props.page
  jumpOpen.value = open
}

function jump() {
  const page = Number(jumpPage.value)
  if (props.disabled || !Number.isInteger(page) || page < 1 || page > pageCount.value) return
  jumpOpen.value = false
  if (page !== props.page) emit('update:page', page)
}

watch(jumpInput, (input) => {
  if (!input) return
  requestAnimationFrame(() => {
    if (jumpOpen.value && jumpInput.value === input) input.$el.focus({ preventScroll: true })
  })
}, { flush: 'post' })
</script>

<template>
  <Pagination
    :page="page"
    :total="pageCount"
    :items-per-page="1"
    :disabled="disabled"
    :aria-label="labels.pagination"
    class="mx-0 w-auto justify-end"
    @update:page="emit('update:page', $event)"
  >
    <PaginationContent class="flex-wrap justify-end">
      <PopoverRoot :open="jumpOpen" @update:open="toggleJump">
        <PopoverTrigger as-child>
          <Button
            ref="jumpTrigger"
            type="button"
            variant="ghost"
            size="sm"
            class="mr-2 px-2 text-foreground tabular-nums disabled:opacity-100"
            :disabled="disabled || pageCount <= 1"
            :aria-label="`${labels.jump} · ${labels.status}`"
          >{{ labels.status }}</Button>
        </PopoverTrigger>
        <PopoverPortal :to="jumpPortal">
          <PopoverContent align="end" :side-offset="6" class="z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
            <form class="flex items-center gap-2" @submit.prevent="jump">
              <Input ref="jumpInput" v-model="jumpPage" type="number" min="1" :max="pageCount" step="1" required class="w-20" :aria-label="labels.jump" />
              <Button type="submit" size="sm">{{ labels.jump }}</Button>
            </form>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
      <PaginationFirst type="button" :class="arrowStyle" :aria-label="labels.first" :title="labels.first">
        <ChevronsLeft aria-hidden="true" />
      </PaginationFirst>
      <PaginationPrevious type="button" size="icon-sm" :class="arrowStyle" :aria-label="labels.previous" :title="labels.previous">
        <ChevronLeftIcon aria-hidden="true" />
      </PaginationPrevious>
      <PaginationNext type="button" size="icon-sm" :class="arrowStyle" :aria-label="labels.next" :title="labels.next">
        <ChevronRight aria-hidden="true" />
      </PaginationNext>
      <PaginationLast type="button" :class="arrowStyle" :aria-label="labels.last" :title="labels.last">
        <ChevronsRight aria-hidden="true" />
      </PaginationLast>
    </PaginationContent>
  </Pagination>
</template>
