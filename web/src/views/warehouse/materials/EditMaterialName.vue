<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import type { InventoryItemContract } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { Textarea } from '@lingdian/console-ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { inventoryItemDetail, renameInventoryMaterial } from '@/services/inventory'
import { useLocale } from '@/i18n/locale'
import { en, zh, type MessageKey } from '../messages'
import { useMaterialProfileLocale } from './profile-locale'
const props = defineProps<{ item: InventoryItemContract; storeId: string }>(),
  emit = defineEmits<{ close: []; saved: [] }>()
const { t } = useMaterialProfileLocale(),
  { locale } = useLocale()
const current = ref({ ...props.item }),
  name = ref(props.item.name),
  reason = ref(''),
  saving = ref(false),
  reading = ref(false),
  stale = ref(false),
  failed = ref(false),
  readDone = ref(false),
  error = ref<'' | 'stale' | 'unexpected' | MessageKey>('')
const busy = computed(() => saving.value || reading.value),
  active = computed(() => current.value.isActive !== false),
  same = computed(() => name.value.trim() === current.value.name)
const errorText = computed(() =>
  !error.value
    ? ''
    : error.value === 'stale' || error.value === 'unexpected'
      ? t(error.value)
      : (locale.value === 'en-US' ? en : zh)[error.value],
)
let sequence = 0
function close() {
  if (!saving.value) emit('close')
}
async function read() {
  if (busy.value) return
  const token = ++sequence
  reading.value = true
  failed.value = false
  error.value = ''
  readDone.value = false
  try {
    const row = await inventoryItemDetail(props.storeId, props.item.id)
    if (row.storeId !== props.storeId || row.id !== props.item.id) throw Error('inventory.notFound')
    if (token === sequence) {
      current.value = row
      stale.value = false
      readDone.value = true
    }
  } catch {
    if (token === sequence) failed.value = true
  } finally {
    if (token === sequence) reading.value = false
  }
}
async function save() {
  if (
    busy.value ||
    stale.value ||
    failed.value ||
    !active.value ||
    same.value ||
    !name.value.trim() ||
    !reason.value.trim()
  )
    return
  const token = sequence
  saving.value = true
  error.value = ''
  try {
    await renameInventoryMaterial(props.storeId, props.item.id, {
      name: name.value.trim(),
      expectedVersion: current.value.version,
      reason: reason.value.trim(),
    })
    if (token === sequence) {
      emit('saved')
      emit('close')
    }
  } catch (e) {
    if (token !== sequence) return
    const message = e instanceof Error ? e.message : ''
    stale.value =
      message === 'inventory.stale' || message === 'inventory.inactive' || message === 'inventory.notFound'
    error.value = stale.value ? 'stale' : Object.hasOwn(zh, message) ? (message as MessageKey) : 'unexpected'
  } finally {
    if (token === sequence) saving.value = false
  }
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <Dialog open @update:open="close"
    ><DialogContent
      class="max-h-[90dvh] max-w-lg overflow-y-auto"
      :close-label="t('cancel')"
      :close-disabled="saving"
      @escape-key-down="saving && $event.preventDefault()"
      @interact-outside="saving && $event.preventDefault()"
      ><DialogHeader
        ><DialogTitle>{{ t('title') }}</DialogTitle
        ><DialogDescription>{{ item.code }} · {{ item.unit }}</DialogDescription></DialogHeader
      >
      <p class="text-xs leading-5 text-muted-foreground">{{ t('hint') }}</p>
      <p class="break-words text-sm">
        <span class="text-muted-foreground">{{ t('current') }}: </span>{{ current.name }}
      </p>
      <p v-if="reading" role="status" class="text-xs text-muted-foreground">{{ t('reading') }}</p>
      <p v-if="readDone" role="status" class="text-xs text-muted-foreground">{{ t('reloaded') }}</p>
      <form class="grid gap-4" @submit.prevent="save">
        <fieldset :disabled="busy" class="grid min-w-0 gap-4">
          <label>{{ t('name') }}<Input v-model="name" required maxlength="120" :readonly="!active" /></label
          ><label
            >{{ t('reason')
            }}<Textarea v-model="reason" rows="3" required maxlength="240" :readonly="!active" />
          </label>
        </fieldset>
        <p v-if="!active" role="status" class="text-sm text-muted-foreground">
          {{ locale === 'en-US' ? en['inventory.inactive'] : zh['inventory.inactive'] }}
        </p>
        <p v-else-if="same" role="status" class="text-xs text-muted-foreground">{{ t('same') }}</p>
        <p v-if="failed" role="alert" class="text-sm text-destructive">{{ t('failure') }}</p>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ errorText }}</p>
        <div class="flex flex-wrap justify-end gap-2 border-t pt-3">
          <DataActionButton action="refresh" :label="t('read')" v-if="stale || failed" :disabled="busy" @click="read" /><Button type="button" variant="ghost" :disabled="saving" @click="close">{{ t('cancel') }}</Button
          ><Button
            type="submit"
            :disabled="busy || stale || failed || !active || same || !name.trim() || !reason.trim()"
            >{{ t(saving ? 'saving' : 'save') }}</Button
          >
        </div>
      </form>
    </DialogContent></Dialog
  >
</template>
<style scoped>
label {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  font-size: 0.875rem;
}
</style>
