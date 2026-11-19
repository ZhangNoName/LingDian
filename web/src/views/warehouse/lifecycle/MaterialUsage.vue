<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { InventoryUsagePage, InventoryUsageRow, InventoryUsageView } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { getInventoryUsage } from '@/services/inventory'
import { downloadCsv } from '../report'
import { useUsageLocale } from './usage-locale'
const props = defineProps<{
    itemId: string
    storeId: string
    storeName: string
    view: InventoryUsageView
    page: number
    disabled: boolean
    revision: number
  }>(),
  emit = defineEmits<{ change: [view: InventoryUsageView, page: number]; inspect: [row: InventoryUsageRow] }>()
const { t, number, date } = useUsageLocale(),
  data = ref<InventoryUsagePage>(),
  loading = ref(true),
  failed = ref(false)
const tabs = ['RECIPES', 'PURCHASES', 'STOCKTAKES'] as const
const count = (view: InventoryUsageView) =>
  data.value?.counts[view === 'RECIPES' ? 'recipes' : view === 'PURCHASES' ? 'purchases' : 'stocktakes'] ?? 0
let sequence = 0
async function load() {
  const token = ++sequence
  loading.value = true
  failed.value = false
  try {
    const result = await getInventoryUsage(props.storeId, props.itemId, props.view, props.page)
    if (token === sequence) {
      data.value = result
      if (result.page !== props.page) emit('change', props.view, result.page)
    }
  } catch {
    if (token === sequence) failed.value = true
  } finally {
    if (token === sequence) loading.value = false
  }
}
watch([() => props.itemId, () => props.storeId, () => props.view, () => props.page, () => props.revision], load, {
  immediate: true,
})
function exportPage() {
  if (!data.value || loading.value || failed.value || props.disabled) return
  const snapshot = data.value,
    rows: (string | number)[][] = [
      [t('store'), props.storeName, snapshot.storeId],
      [t('material'), snapshot.item.name, snapshot.item.id],
      [t('code'), snapshot.item.code, t('unit'), snapshot.item.unit],
      [t('generated'), snapshot.generatedAt],
      [t('view'), t(snapshot.view)],
      [t('page'), snapshot.page, t('records'), snapshot.total],
      [t('csvHint')],
      ...(snapshot.unavailableRecipes ? [[t('unavailable'), snapshot.unavailableRecipes]] : []),
      [
        t('identifier'),
        t('name'),
        t('detail'),
        t('state'),
        t(snapshot.view === 'RECIPES' ? 'perUnit' : snapshot.view === 'PURCHASES' ? 'outstanding' : 'counted'),
        t('unit'),
        t('expected'),
        t('created'),
      ],
    ]
  for (const row of snapshot.items) {
    if (row.kind === 'RECIPES')
      rows.push([
        row.skuId,
        row.productName,
        row.skuName,
        [
          t(row.skuIsActive ? 'activeSku' : 'inactiveSku'),
          t(row.productStatus === 'ACTIVE' ? 'published' : 'unpublished'),
        ].join(' · '),
        row.quantity,
        snapshot.item.unit,
        '',
        '',
      ])
    else if (row.kind === 'PURCHASES')
      rows.push([
        row.orderId,
        row.orderNo,
        row.supplierName,
        t(row.status),
        row.remainingQuantity,
        snapshot.item.unit,
        row.expectedAt ?? '',
        '',
      ])
    else
      rows.push([
        row.stocktakeId,
        row.title,
        row.createdAt,
        t('STOCKTAKES'),
        row.countedQuantity ?? '',
        snapshot.item.unit,
        '',
        row.createdAt,
      ])
  }
  downloadCsv(`material-related-${snapshot.view.toLowerCase()}-p${snapshot.page}.csv`, rows)
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <section :aria-label="t('title')" class="grid min-w-0 gap-3 border-y py-3">
    <details class="text-xs leading-5 text-muted-foreground">
      <summary class="cursor-pointer">{{ t('rules') }}</summary>
      <p class="mt-2">{{ t('hint') }}</p>
    </details>
    <div class="flex max-w-full flex-wrap gap-1">
      <Button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        size="sm"
        :variant="view === tab ? 'secondary' : 'ghost'"
        :aria-pressed="view === tab"
        :disabled="disabled || loading"
        @click="$emit('change', tab, 1)"
        >{{ t(tab)
        }}<span v-if="data && !failed && !loading" class="ml-1 tabular-nums">{{ number(count(tab)) }}</span></Button
      >
    </div>
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="failed" role="alert" class="grid justify-items-start gap-2 text-sm text-destructive">
      <p>{{ t('failed') }}</p>
      <Button type="button" size="sm" variant="outline" :disabled="disabled" @click="load">{{ t('refresh') }}</Button>
    </div>
    <template v-else-if="data"
      ><p v-if="data.unavailableRecipes" role="status" class="text-xs leading-5 text-amber-800">
        {{ t('unavailable') }} ({{ number(data.unavailableRecipes) }})
      </p>
      <p v-if="!data.items.length" class="py-3 text-sm text-muted-foreground">{{ t('empty') }}</p>
      <ul v-else class="grid gap-2">
        <li
          v-for="row in data.items"
          :key="row.kind === 'RECIPES' ? row.skuId : row.kind === 'PURCHASES' ? row.orderId : row.stocktakeId"
          class="grid min-w-0 gap-2 rounded-md border p-3 text-sm"
        >
          <template v-if="row.kind === 'RECIPES'"
            ><strong class="break-words">{{ row.productName }} · {{ row.skuName }}</strong>
            <p class="text-xs text-muted-foreground">
              {{ t(row.skuIsActive ? 'activeSku' : 'inactiveSku') }} ·
              {{ t(row.productStatus === 'ACTIVE' ? 'published' : 'unpublished') }}
            </p>
            <p>{{ t('perUnit') }}: {{ number(row.quantity) }} {{ data.item.unit }}</p></template
          ><template v-else-if="row.kind === 'PURCHASES'"
            ><strong class="break-words">{{ row.orderNo }} · {{ row.supplierName }}</strong>
            <p class="text-xs text-muted-foreground">
              {{ t(row.status) }} · {{ t('expected') }}: {{ date(row.expectedAt) }}
            </p>
            <p>{{ t('outstanding') }}: {{ number(row.remainingQuantity) }} {{ data.item.unit }}</p></template
          ><template v-else
            ><strong class="break-words">{{ row.title }}</strong>
            <p class="text-xs text-muted-foreground">{{ t('created') }}: {{ date(row.createdAt) }}</p>
            <p>
              {{ t('counted') }}:
              {{ row.countedQuantity === null ? t('blank') : number(row.countedQuantity) + ' ' + data.item.unit }}
            </p></template
          ><Button
            type="button"
            size="sm"
            variant="outline"
            class="justify-self-end"
            :disabled="disabled"
            @click="$emit('inspect', row)"
            >{{ t('inspect') }}</Button
          >
        </li>
      </ul>
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span
          >{{ number(data.total) }} {{ t('records') }} · {{ t('page') }} {{ data.page }} /
          {{ Math.max(1, Math.ceil(data.total / 20)) }}</span
        >
        <div class="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="disabled || data.page <= 1"
            @click="$emit('change', view, data.page - 1)"
            >{{ t('previous') }}</Button
          ><Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="disabled || data.page * 20 >= data.total"
            @click="$emit('change', view, data.page + 1)"
            >{{ t('next') }}</Button
          >
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" :disabled="disabled" @click="load">{{ t('refresh') }}</Button
        ><Button
          type="button"
          size="sm"
          variant="ghost"
          :disabled="disabled || !data.items.length"
          @click="exportPage"
          >{{ t('export') }}</Button
        >
      </div>
      <p class="text-xs text-muted-foreground">{{ t('snapshot') }}: {{ date(data.generatedAt) }}</p></template
    >
  </section>
</template>
