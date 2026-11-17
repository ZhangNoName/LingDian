<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { InventoryItemContract } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { changeInventoryLifecycle, inventoryItemDetail } from '@/services/inventory'
import { lifecycleError, useLifecycleLocale, type LifecycleKey } from './locale'
const props = defineProps<{ item?: InventoryItemContract; storeId: string }>(),
  emit = defineEmits<{ close: []; saved: [] }>()
const { locale, t } = useLifecycleLocale(),
  current = ref<InventoryItemContract>(),
  desired = ref(false),
  reason = ref(''),
  saving = ref(false),
  reading = ref(false),
  error = ref<LifecycleKey>()
const busy = computed(() => saving.value || reading.value),
  done = computed(() => current.value && (current.value.isActive !== false) === desired.value)
let sequence = 0
watch(
  () => props.item,
  (item) => {
    sequence++
    current.value = item
    desired.value = item?.isActive === false
    reason.value = ''
    error.value = undefined
  },
  { immediate: true },
)
function close() {
  if (!busy.value) emit('close')
}
async function submit() {
  if (!current.value || busy.value || done.value) return
  saving.value = true
  error.value = undefined
  const token = sequence
  try {
    await changeInventoryLifecycle(props.storeId, current.value.id, {
      isActive: desired.value,
      expectedVersion: current.value.version,
      reason: reason.value.trim(),
    })
    if (token === sequence) {
      emit('saved')
      emit('close')
    }
  } catch (e) {
    if (token === sequence) error.value = lifecycleError(e)
  } finally {
    if (token === sequence) saving.value = false
  }
}
async function read() {
  if (!current.value || busy.value) return
  reading.value = true
  error.value = undefined
  const token = sequence
  try {
    const item = await inventoryItemDetail(props.storeId, current.value.id)
    if (token === sequence) {
      current.value = item
      if (done.value) emit('saved')
    }
  } catch (e) {
    if (token === sequence) error.value = lifecycleError(e)
  } finally {
    if (token === sequence) reading.value = false
  }
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <Dialog :open="!!item" @update:open="close"
    ><DialogContent
      class="max-h-[90dvh] max-w-lg overflow-y-auto"
      :close-label="t('close')"
      :close-disabled="busy"
      @escape-key-down="busy && $event.preventDefault()"
      @interact-outside="busy && $event.preventDefault()"
      ><DialogHeader
        ><DialogTitle>{{ t(desired ? 'restoreTitle' : 'archiveTitle') }} · {{ current?.name }}</DialogTitle
        ><DialogDescription>{{ current?.code }} · {{ current?.unit }}</DialogDescription></DialogHeader
      >
      <p class="text-sm leading-6 text-muted-foreground">{{ t(desired ? 'restoreHint' : 'archiveHint') }}</p>
      <dl v-if="current" class="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
        <div>
          <dt class="text-xs text-muted-foreground">{{ t('quantity') }}</dt>
          <dd class="mt-1 break-words tabular-nums">
            {{ current.quantity.toLocaleString(locale) }} {{ current.unit }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">{{ t('reserved') }}</dt>
          <dd class="mt-1 break-words tabular-nums">
            {{ (current.reservedQuantity ?? 0).toLocaleString(locale) }} {{ current.unit }}
          </dd>
        </div>
      </dl>
      <p v-if="!desired" class="text-xs leading-5 text-muted-foreground">{{ t('conditions') }}</p>
      <p v-if="current?.lifecycleChangedAt" class="break-words text-xs leading-5 text-muted-foreground">
        {{ t('changed') }}: {{ new Date(current.lifecycleChangedAt).toLocaleString(locale) }} · {{ t('actor') }}:
        {{ current.lifecycleActorId }}<br />{{ current.lifecycleReason }}
      </p>
      <p v-if="done" role="status" class="text-sm">{{ t('done') }}</p>
      <form v-else class="grid gap-4" @submit.prevent="submit">
        <label class="grid gap-2 text-sm"
          >{{ t('reason')
          }}<textarea
            v-model="reason"
            required
            maxlength="240"
            rows="3"
            :disabled="busy"
            class="min-w-0 rounded-md border bg-card px-3 py-2 text-sm"
          />
        </label>
        <p v-if="error" role="alert" class="text-sm leading-6 text-destructive">{{ t(error) }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <Button v-if="error" type="button" variant="outline" :disabled="busy" @click="read">{{
            t(reading ? 'reading' : 'read')
          }}</Button
          ><Button type="button" variant="ghost" :disabled="busy" @click="close">{{ t('cancel') }}</Button
          ><Button type="submit" :disabled="busy || !reason.trim()">{{
            t(saving ? 'saving' : desired ? 'confirmRestore' : 'confirmArchive')
          }}</Button>
        </div>
      </form>
      <Button v-if="done" variant="outline" class="justify-self-end" @click="close">{{ t('close') }}</Button>
    </DialogContent></Dialog
  >
</template>
