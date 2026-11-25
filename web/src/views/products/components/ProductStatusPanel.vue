<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ProductRecordContract, ProductStatus } from '@lingdian/contracts'
import { catalogStatusActions, catalogStatusBadge } from '../catalog-lifecycle'
import { Badge } from '@lingdian/console-ui/badge'
import { Button, IconButton } from '@lingdian/console-ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { DropdownMenu } from '@lingdian/console-ui/dropdown'
import { MoreHorizontal } from '@lingdian/icons/web'
import { updateMerchantProductStatus } from '@/services/products'
import { useCatalogLocale, catalogError, type CatalogKey } from '../catalog-management-locale'
const props = defineProps<{ product: ProductRecordContract; storeId: string; disabled: boolean; dirty: boolean }>(),
  emit = defineEmits<{ busy: [boolean]; saved: [ProductRecordContract] }>(),
  { t } = useCatalogLocale(),
  target = ref<ProductStatus>(),
  saving = ref(false),
  error = ref<CatalogKey>()
const trigger = ref<InstanceType<typeof IconButton>>()
const actions = computed(() => catalogStatusActions(props.product.status).map(action => ({ value: action.status, label: t(action.label) })))
const actionLabel = computed(() => actions.value.find(action => action.value === target.value)?.label)
function choose(status: string) {
  if (props.disabled || props.dirty || saving.value) return
  target.value = actions.value.find(action => action.value === status)?.value
  error.value = undefined
}

function close(open: boolean) {
  if (!open && !saving.value) target.value = undefined
}

function closeOnEscape(event: KeyboardEvent) {
  event.preventDefault()
  close(false)
}

function restoreFocus(event: Event) {
  event.preventDefault()
  trigger.value?.$el.focus({ preventScroll: true })
}
let disposed = false
async function submit() {
  if (!target.value || saving.value || props.disabled || props.dirty || props.product.configuration_version === undefined) return
  saving.value = true
  emit('busy', true)
  error.value = undefined
  try {
    const result = await updateMerchantProductStatus(props.storeId, props.product.id, {
      status: target.value,
      expected_version: props.product.configuration_version,
    })
    if (disposed) return
    target.value = undefined
    emit('saved', result)
  } catch (e) {
    if (!disposed) error.value = catalogError(e)
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
onBeforeUnmount(() => {
  disposed = true
})
</script>
<template>
  <div class="flex shrink-0 items-center gap-2" :title="dirty ? t('saveBeforeStatus') : undefined">
    <Badge :variant="catalogStatusBadge(product.status)">{{ t(product.status) }}</Badge>
    <DropdownMenu v-if="actions.length" :items="actions" @select="choose">
      <IconButton
        ref="trigger"
        :icon="MoreHorizontal"
        :label="t('statusActions')"
        :disabled="disabled || dirty || saving || product.configuration_version === undefined"
      />
    </DropdownMenu>
  </div>

  <Dialog :open="!!target" @update:open="close">
    <DialogContent
      class="w-[min(92vw,27rem)]"
      :close-label="t('close')"
      :close-disabled="saving"
      @close-auto-focus="restoreFocus"
      @escape-key-down="closeOnEscape"
    >
      <DialogHeader>
        <DialogTitle>{{ actionLabel }}</DialogTitle>
        <DialogDescription>{{ t(target === 'ACTIVE' ? 'publishHint' : 'unpublishHint') }}</DialogDescription>
      </DialogHeader>
      <RouterLink v-if="target === 'ACTIVE'" class="text-sm text-primary" to="/warehouse?view=recipes">
        {{ t('recipe') }}
      </RouterLink>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
      <DialogFooter>
        <Button type="button" variant="outline" :disabled="saving" @click="close(false)">{{ t('cancel') }}</Button>
        <Button type="button" :disabled="saving || disabled" @click="submit">
          {{ t(saving ? 'saving' : 'confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
