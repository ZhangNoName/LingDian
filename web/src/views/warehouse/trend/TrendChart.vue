<script setup lang="ts">
import { RangeInput } from '@lingdian/console-ui/input'
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { InventoryTrendDay } from '@lingdian/contracts'
import { trendGeometry } from './model'
import { useTrendLocale } from './locale'
const props = defineProps<{ days: InventoryTrendDay[]; selected: number; unit: string; disabled: boolean }>(),
  emit = defineEmits<{ select: [index: number] }>()
const root = ref<HTMLElement>(),
  width = ref(0),
  { t, number, day, axis } = useTrendLocale(),
  id = useId()
const graph = computed(() => trendGeometry(props.days, width.value || 300)),
  current = computed(() => props.days[props.selected])
let resizeFrame = 0
useResizeObserver(root, ([entry]) => {
  if (!entry) return
  cancelAnimationFrame(resizeFrame)
  const nextWidth = entry.contentRect.width
  if (nextWidth === width.value) return
  resizeFrame = requestAnimationFrame(() => {
    width.value = nextWidth
  })
})
onBeforeUnmount(() => cancelAnimationFrame(resizeFrame))
function select(index: number) {
  if (!props.disabled && Number.isFinite(index))
    emit('select', Math.max(0, Math.min(props.days.length - 1, Math.round(index))))
}
function inspect(event: MouseEvent) {
  const box = (event.currentTarget as SVGGraphicsElement).getBoundingClientRect()
  select(((event.clientX - box.left) / box.width) * (props.days.length - 1))
}
</script>
<template>
  <figure ref="root" class="grid min-w-0 gap-3" :aria-labelledby="id + '-heading'">
    <figcaption class="flex flex-wrap items-center justify-between gap-2">
      <h3 :id="id + '-heading'" class="text-sm font-semibold">{{ t('chart') }}</h3>
      <span class="text-xs text-muted-foreground">{{ unit }}</span>
    </figcaption>
    <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      <span class="inline-flex items-center gap-2"
        ><span class="h-0 w-5 border-t-2 border-primary" aria-hidden="true" />{{
          t('availableClosing')
        }}</span
      ><span class="inline-flex items-center gap-2"
        ><span class="h-0 w-5 border-t-2 border-dashed border-slate-500" aria-hidden="true" />{{
          t('closing')
        }}</span
      >
    </div>
    <svg
      :viewBox="`0 0 ${graph.width} ${graph.height}`"
      :width="graph.width"
      :height="graph.height"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-labelledby="id + '-title ' + id + '-description'"
    >
      <title :id="id + '-title'">{{ t('chart') }} · {{ unit }}</title>
      <desc :id="id + '-description'">{{ t('lineHint') }} {{ t('context') }}</desc>
      <g v-for="tick in graph.yTicks" :key="tick">
        <line
          :x1="graph.left"
          :x2="graph.right"
          :y1="graph.y(tick)"
          :y2="graph.y(tick)"
          class="stroke-border"
          stroke-width="0.75"
          shape-rendering="crispEdges"
        />
        <text
          :x="graph.left - 8"
          :y="graph.y(tick) + 4"
          text-anchor="end"
          class="fill-muted-foreground"
          font-size="11"
        >
          {{ axis(tick) }}
        </text>
      </g>
      <g v-for="index in graph.ticks" :key="index">
        <text
          :x="graph.x(index)"
          :y="graph.height - 7"
          :text-anchor="
            days.length === 1
              ? 'middle'
              : index === days.length - 1
                ? 'end'
                : index === 0
                  ? 'start'
                  : 'middle'
          "
          class="fill-muted-foreground"
          font-size="11"
        >
          {{ day(days[index]!.date) }}
        </text>
      </g>
      <path
        :d="graph.onHand"
        fill="none"
        stroke="#64748b"
        stroke-width="1.75"
        stroke-dasharray="5 3"
        vector-effect="non-scaling-stroke"
      />
      <path
        :d="graph.available"
        fill="none"
        class="stroke-primary"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />
      <line
        v-if="current"
        :x1="graph.x(selected)"
        :x2="graph.x(selected)"
        :y1="graph.top"
        :y2="graph.bottom"
        class="stroke-muted-foreground"
        stroke-width="0.75"
        stroke-dasharray="2 3"
      />
      <template v-if="current?.state === 'RECORDED'">
        <circle :cx="graph.x(selected)" :cy="graph.y(current.closing!)" r="3" fill="#64748b" />
        <circle
          :cx="graph.x(selected)"
          :cy="graph.y(current.availableClosing!)"
          r="3.5"
          fill="white"
          class="stroke-primary"
          stroke-width="2"
        />
      </template>
      <rect
        :x="graph.left"
        :y="graph.top"
        :width="graph.right - graph.left"
        :height="graph.bottom - graph.top"
        fill="transparent"
        aria-hidden="true"
        class="touch-pan-y"
        @click="inspect"
      />
    </svg>
    <label class="grid gap-2 text-xs text-muted-foreground"
      >{{ t('select')
      }}<RangeInput
        :max="Math.max(0, days.length - 1)"
        :aria-label="t('select')"
        :model-value="selected"
        :disabled="disabled"
        :aria-valuetext="
          current
            ? `${current.date} · ${current.state === 'RECORDED' ? t('availableClosing') + ': ' + number(current.availableClosing) + ' ' + unit : t(current.state)}`
            : ''
        "
        @update:model-value="select"
    /></label>
  </figure>
</template>
