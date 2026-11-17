<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Button } from '@/baseComponents/button'
import type { InventoryMovementKind } from '@lingdian/contracts'
import { analysisBars, type AnalysisRow } from './model'
import { useAnalysisLocale } from './locale'
const props = defineProps<{ row: AnalysisRow; disabled: boolean }>(),
  emit = defineEmits<{ history: [InventoryMovementKind]; clear: [] }>(),
  { t, number, percent } = useAnalysisLocale()
const bars = computed(() => analysisBars(props.row)),
  heading = ref<HTMLHeadingElement>()
watch(
  () => props.row.itemId,
  async () => {
    await nextTick()
    heading.value?.focus({ preventScroll: true })
    heading.value?.scrollIntoView({ block: 'nearest' })
  },
  { immediate: true },
)
</script>
<template>
  <section aria-labelledby="material-analysis-title" class="grid min-w-0 gap-4 rounded-md border p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 ref="heading" tabindex="-1" id="material-analysis-title" class="break-words text-sm font-semibold">
          {{ t('detail') }} · {{ row.name }}
        </h3>
        <p class="mt-1 break-all text-xs text-muted-foreground">{{ row.code }} · {{ row.unit }}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" :disabled="disabled" @click="$emit('clear')">{{
        t('clear')
      }}</Button>
    </div>
    <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div v-for="key in ['opening', 'closing', 'countDifference'] as const" :key="key">
        <dt class="text-xs text-muted-foreground">{{ t(key) }}</dt>
        <dd class="mt-1 break-words tabular-nums">{{ number(row[key]) }} {{ row.unit }}</dd>
      </div>
      <div>
        <dt class="text-xs text-muted-foreground">{{ t('lossRate') }}</dt>
        <dd class="mt-1 tabular-nums">{{ percent(row.lossRate) }}</dd>
      </div>
    </dl>
    <ul class="grid gap-3" :aria-label="t('detail')">
      <li v-for="bar in bars" :key="bar.key" class="grid gap-1">
        <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
          <span>{{ t(bar.key) }}</span
          ><strong class="ml-auto min-w-0 max-w-full break-words text-right font-medium tabular-nums"
            >{{ number(bar.value) }} {{ row.unit }}</strong
          >
        </div>
        <div aria-hidden="true" class="h-2 overflow-hidden rounded-sm bg-muted">
          <div
            class="h-full"
            :class="bar.key === 'lost' ? 'bg-amber-600' : 'bg-slate-500'"
            :style="{ width: bar.width + '%' }"
          />
        </div>
      </li>
    </ul>
    <p class="text-xs leading-5 text-muted-foreground">{{ t('comparisonHint') }}</p>
    <div class="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        :disabled="disabled || row.issued === 0"
        @click="$emit('history', 'ISSUE')"
        >{{ t('issueRecords') }}</Button
      ><Button
        type="button"
        size="sm"
        variant="outline"
        :disabled="disabled || row.lost === 0"
        @click="$emit('history', 'LOSS')"
        >{{ t('lossRecords') }}</Button
      ><Button type="button" size="sm" variant="outline" :disabled="disabled" @click="$emit('history', 'COUNT')">{{
        t('countRecords')
      }}</Button>
    </div>
  </section>
</template>
