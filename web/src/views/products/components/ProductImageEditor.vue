<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ProductRecordContract } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { FileInput } from '@lingdian/console-ui/input'
import { apiUrl } from '@/config/api'
import { uploadMerchantImage, removeMerchantImage, productImageSource } from '@/services/product-images'
import { useImageLocale, imageError, type ImageKey } from '../image-locale'
const props = defineProps<{ storeId: string; product: ProductRecordContract; disabled: boolean }>(),
  emit = defineEmits<{ busy: [boolean]; dirty: [boolean]; saved: [ProductRecordContract]; reload: [] }>(),
  { t } = useImageLocale()
const file = ref<File>(),
  preview = ref(''),
  saving = ref(false),
  removing = ref(false),
  reloadConfirm = ref(false),
  error = ref<ImageKey>(),
  notice = ref(false),
  broken = ref(false),
  input = ref<InstanceType<typeof FileInput>>()
const current = computed(() => productImageSource(props.product.image_url, apiUrl('/'), window.location.href)),
  source = computed(() => preview.value || current.value),
  dirty = computed(() => !!file.value || removing.value || reloadConfirm.value)
watch(dirty, (value) => emit('dirty', value), { immediate: true })
watch(source, () => {
  broken.value = false
})
let requestId = '',
  version = 0,
  disposed = false
function resetSelection(resetInput: boolean) {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  file.value = undefined
  removing.value = false
  reloadConfirm.value = false
  error.value = undefined
  if (resetInput) input.value?.clear()
}
function clear() { resetSelection(true) }
function choose(files: FileList) {
  const selected = files[0]
  if (!selected) return
  resetSelection(false)
  notice.value = false
  if (selected.size > 3 * 1024 * 1024) {
    error.value = 'imageTooLarge'
    input.value?.clear()
    return
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
    error.value = 'imageType'
    input.value?.clear()
    return
  }
  file.value = selected
  preview.value = URL.createObjectURL(selected)
  requestId = crypto.randomUUID()
  version = props.product.configuration_version ?? -1
}
function remove() {
  requestId = crypto.randomUUID()
  version = props.product.configuration_version ?? -1
  removing.value = true
  error.value = undefined
  notice.value = false
}
async function save() {
  if (
    saving.value ||
    props.disabled ||
    props.product.configuration_version === undefined ||
    (!file.value && !removing.value)
  )
    return
  saving.value = true
  emit('busy', true)
  error.value = undefined
  try {
    const result = file.value
      ? await uploadMerchantImage(props.storeId, props.product.id, file.value, requestId, version)
      : await removeMerchantImage(props.storeId, props.product.id, requestId, version)
    if (!disposed) {
      clear()
      notice.value = true
      emit('saved', result)
    }
  } catch (e) {
    if (!disposed) error.value = imageError(e)
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
function reload() {
  clear()
  emit('reload')
}
onBeforeUnmount(() => {
  disposed = true
  if (preview.value) URL.revokeObjectURL(preview.value)
  emit('dirty', false)
})
</script>
<template>
  <section class="grid min-w-0 gap-4">
    <p class="help">{{ t('hint') }}</p>
    <div class="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-3 sm:gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <div
        class="flex h-24 w-24 justify-self-center items-center justify-center overflow-hidden border bg-muted/20 sm:h-48 sm:w-48"
      >
        <img
          v-if="source && !broken"
          :src="source"
          :alt="t(file ? 'preview' : 'current')"
          class="h-full w-full object-contain"
          @error="broken = true"
        />
        <p v-else role="status" class="p-4 text-center text-sm text-muted-foreground">
          {{ t(broken ? 'unavailable' : 'empty') }}
        </p>
      </div>
      <div class="grid min-w-0 content-start gap-3">
        <label class="grid min-w-0 gap-2 text-sm"
          >{{ t('choose')
          }}<FileInput
            ref="input"
            accept="image/jpeg,image/png,image/webp"
            :disabled="saving || disabled || removing || reloadConfirm || product.configuration_version === undefined"
            @select="choose"
        /></label>
        <p v-if="file" class="break-words text-xs text-muted-foreground">
          {{ t('selected') }}: {{ file.name }} · {{ Math.ceil(file.size / 1024) }} KB
        </p>
        <p v-if="disabled" class="help">{{ t('disabled') }}</p>
        <div class="flex flex-wrap gap-2">
          <Button v-if="file" type="button" variant="outline" :disabled="saving || disabled" @click="clear">{{
            t('cancel')
          }}</Button
          ><Button v-if="file" type="button" :disabled="saving || disabled" @click="save">{{
            t(saving ? 'saving' : 'upload')
          }}</Button
          ><Button
            v-if="!file && product.image_url && !removing"
            type="button"
            variant="outline"
            :disabled="saving || disabled || product.configuration_version === undefined"
            @click="remove"
            >{{ t('remove') }}</Button
          >
        </div>
      </div>
    </div>
    <div v-if="removing" class="grid gap-3 border p-3">
      <p class="text-sm">{{ t('removeHint') }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" :disabled="saving" @click="clear">{{ t('keep') }}</Button
        ><Button type="button" :disabled="saving || disabled" @click="save">{{
          t(saving ? 'saving' : 'confirm')
        }}</Button>
      </div>
    </div>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
    <p v-if="product.configuration_version === undefined" role="alert" class="text-sm text-destructive">
      {{ t('version') }}
    </p>
    <p v-if="notice" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
    <DataActionButton
      action="refresh"
      :label="t('reload')"
      class="justify-self-start"
      size="icon-sm"
      variant="ghost"
      :disabled="saving || disabled"
      @click="reloadConfirm = true"
    />
    <div v-if="reloadConfirm" class="grid gap-3 border p-3">
      <p class="text-sm">{{ t('reloadHint') }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="outline" @click="reloadConfirm = false">{{ t('back') }}</Button
        ><Button @click="reload">{{ t('confirmReload') }}</Button>
      </div>
    </div>
  </section>
</template>
<style scoped src="../catalog-management.css"></style>
