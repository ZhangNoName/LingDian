<script setup lang="ts">
import { Disclosure } from '@lingdian/console-ui/collapsible'
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  InventoryItemContract,
  InventoryUsageRow,
  InventoryUsageView,
  InventoryMaterialChangeKind,
} from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { useLocale } from '@/i18n/locale'
import { inventoryItemDetail } from '@/services/inventory'
import InventoryEditor from '../InventoryEditor.vue'
import MaterialLifecycle from '../lifecycle/MaterialLifecycle.vue'
import MaterialUsage from '../lifecycle/MaterialUsage.vue'
import RelatedRecordDialog from '../lifecycle/RelatedRecordDialog.vue'
import { useLifecycleLocale } from '../lifecycle/locale'
import { useUsageLocale } from '../lifecycle/usage-locale'
import { en, zh, type MessageKey } from '../messages'
import { useMaterialLocale } from './locale'
import { useMaterialProfileLocale } from './profile-locale'
import EditMaterialName from './EditMaterialName.vue'
import MaterialChanges from './MaterialChanges.vue'
import { useTrendLocale } from '../trend/locale'
const props = defineProps<{ id: string; storeId: string; storeName: string }>(),
  emit = defineEmits<{
    close: []
    saved: []
    history: [id: string]
    report: [id: string]
    trend: [id: string]
    replenish: [id: string]
  }>()
const { locale } = useLocale(),
  { t: mt } = useMaterialLocale(),
  { t: lt } = useLifecycleLocale(),
  { t: ut } = useUsageLocale(),
  { t: pt } = useMaterialProfileLocale()
const { t: tt } = useTrendLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const row = ref<InventoryItemContract>(),
  loading = ref(true),
  failed = ref(false),
  reloaded = ref(false)
const mode = ref<'DETAIL' | 'ADJUST' | 'LIFECYCLE' | 'RELATED' | 'NAME'>('DETAIL'),
  related = ref<InventoryUsageRow>(),
  changed = ref(false)
const showUsage = ref(false),
  usageView = ref<InventoryUsageView>('RECIPES'),
  usagePage = ref(1),
  revision = ref(0)
const showChanges = ref(false),
  changeKind = ref<InventoryMaterialChangeKind | 'ALL'>('ALL'),
  changePage = ref(1)
const isActive = computed(() => row.value?.isActive !== false)
const statusKey = { HEALTHY: 'healthy', LOW: 'low', OUT: 'out' } as const
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
let sequence = 0,
  disposed = false
async function load(refresh = false) {
  const token = ++sequence
  loading.value = true
  failed.value = false
  reloaded.value = false
  try {
    const result = await inventoryItemDetail(props.storeId, props.id)
    if (result.storeId !== props.storeId || result.id !== props.id) throw new Error('inventory.notFound')
    if (token === sequence) {
      row.value = result
      reloaded.value = refresh
    }
  } catch {
    if (token === sequence) failed.value = true
  } finally {
    if (token === sequence) loading.value = false
  }
}
watch(
  [() => props.id, () => props.storeId],
  () => {
    row.value = undefined
    void load()
  },
  { immediate: true },
)
function action(next: 'ADJUST' | 'LIFECYCLE' | 'NAME') {
  if (
    !row.value ||
    loading.value ||
    failed.value ||
    ((next === 'ADJUST' || next === 'NAME') && !isActive.value)
  )
    return
  changed.value = false
  mode.value = next
}
function inspect(record: InventoryUsageRow) {
  changed.value = false
  related.value = record
  mode.value = 'RELATED'
}
function usageChange(view: InventoryUsageView, page: number) {
  usageView.value = view
  usagePage.value = page
}
function changePageState(kind: InventoryMaterialChangeKind | 'ALL', page: number) {
  changeKind.value = kind
  changePage.value = page
}
function close() {
  if (mode.value === 'DETAIL') emit('close')
}
async function finish() {
  if (disposed) return
  mode.value = 'DETAIL'
  related.value = undefined
  revision.value++
  if (changed.value) {
    changed.value = false
    emit('saved')
  }
  await load(true)
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <Dialog :open="mode === 'DETAIL'" @update:open="!$event && close()"
    ><DialogContent class="max-h-[90dvh] max-w-2xl overflow-y-auto" :close-label="mt('close')"
      ><DialogHeader
        ><DialogTitle>{{ row?.name ?? mt('detail') }}</DialogTitle
        ><DialogDescription
          >{{ storeName
          }}<template v-if="row"> · {{ row.code }} · {{ row.unit }}</template></DialogDescription
        ></DialogHeader
      >
      <p v-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="failed" role="alert" class="grid justify-items-start gap-3 text-sm text-destructive">
        <p>{{ mt('failure') }}</p>
        <DataActionButton action="refresh" :label="mt('read')" @click="load(true)" />
      </div>
      <template v-else-if="row">
        <p v-if="reloaded" role="status" class="text-xs text-muted-foreground">{{ mt('refreshed') }}</p>
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span
            >{{ lt(isActive ? 'ACTIVE' : 'ARCHIVED')
            }}<template v-if="isActive"> · {{ t(statusKey[row.status]) }}</template></span
          ><span class="text-xs text-muted-foreground">{{ t('updated') }}: {{ date(row.updatedAt) }}</span>
        </div>
        <dl class="grid grid-cols-3 gap-3 border p-3 text-sm">
          <div
            v-for="metric in [
              { key: 'quantity' as const, value: row.quantity },
              { key: 'reserved' as const, value: row.reservedQuantity ?? 0 },
              { key: 'available' as const, value: row.availableQuantity ?? row.quantity },
            ]"
            :key="metric.key"
          >
            <dt class="text-xs text-muted-foreground">{{ t(metric.key) }}</dt>
            <dd class="mt-2 break-words font-semibold tabular-nums">
              {{ number(metric.value) }} {{ row.unit }}
            </dd>
          </div>
        </dl>
        <p class="text-xs leading-5 text-muted-foreground">{{ mt('stockHint') }}</p>
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{{ t('threshold') }}: {{ number(row.reorderPoint) }} {{ row.unit }}</span
          ><span v-if="isActive">{{ t('shortage') }}: {{ number(row.shortage) }} {{ row.unit }}</span>
        </div>
        <p v-if="!isActive" class="border p-3 text-sm text-muted-foreground">
          {{ mt('archivedHint') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button v-if="isActive" @click="action('ADJUST')">{{ t('adjust') }}</Button
          ><Button v-if="isActive" variant="outline" @click="$emit('replenish', row.id)">{{
            t('replenish')
          }}</Button
          ><Button variant="outline" @click="$emit('history', row.id)">{{ mt('history') }}</Button
          ><Button variant="outline" @click="$emit('report', row.id)">{{ mt('report') }}</Button
          ><Button variant="outline" @click="$emit('trend', row.id)">{{ tt('near') }}</Button>
        </div>
        <div class="grid min-w-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            class="justify-self-start"
            :aria-expanded="showChanges"
            aria-controls="material-change-records"
            @click="showChanges = !showChanges"
            >{{ pt(showChanges ? 'hideHistory' : 'history') }}</Button
          ><MaterialChanges
            v-if="showChanges"
            id="material-change-records"
            :store-id="storeId"
            :store-name="storeName"
            :item-id="row.id"
            :kind="changeKind"
            :page="changePage"
            :revision="revision"
            @change="changePageState"
          />
        </div>
        <Disclosure v-if="row.lifecycleChangedAt" class="text-xs leading-5 text-muted-foreground">
          <template #label>{{ mt('lifecycle') }}</template>
          <p class="mt-2 break-words">
            {{ date(row.lifecycleChangedAt) }} · {{ row.lifecycleActorId }}<br />{{ row.lifecycleReason }}
          </p>
        </Disclosure>
        <div class="grid min-w-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            class="justify-self-start"
            :aria-expanded="showUsage"
            aria-controls="material-detail-related"
            @click="showUsage = !showUsage"
            >{{ ut(showUsage ? 'hide' : 'show') }}</Button
          ><MaterialUsage
            v-if="showUsage"
            id="material-detail-related"
            :item-id="row.id"
            :store-id="storeId"
            :store-name="storeName"
            :view="usageView"
            :page="usagePage"
            :disabled="loading"
            :revision="revision"
            @change="usageChange"
            @inspect="inspect"
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <Button v-if="isActive" variant="ghost" @click="action('NAME')">{{ pt('edit') }}</Button>
          <Button variant="ghost" @click="action('LIFECYCLE')">{{
            lt(isActive ? 'archive' : 'restore')
          }}</Button
          ><DataActionButton action="refresh" :label="mt('read')" variant="ghost" @click="load(true)" />
        </div>
      </template>
    </DialogContent></Dialog
  >
  <InventoryEditor
    v-if="mode === 'ADJUST' && row"
    :open="true"
    :store-id="storeId"
    :item="row"
    @update:open="!$event && finish()"
    @saved="changed = true"
  />
  <EditMaterialName
    v-else-if="mode === 'NAME' && row"
    :item="row"
    :store-id="storeId"
    @close="finish"
    @saved="changed = true"
  />
  <MaterialLifecycle
    v-else-if="mode === 'LIFECYCLE' && row"
    :item="row"
    :store-id="storeId"
    :store-name="storeName"
    @close="finish"
    @saved="changed = true"
  />
  <RelatedRecordDialog
    v-else-if="mode === 'RELATED'"
    :record="related"
    :store-id="storeId"
    :store-name="storeName"
    @close="finish"
    @saved="changed = true"
  />
</template>
