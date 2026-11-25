<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { ProductRecordContract } from '@lingdian/contracts'
import { IconButton } from '@lingdian/console-ui/button'
import { FileInput } from '@lingdian/console-ui/input'
import { Trash2, Undo2, Upload, X } from '@lingdian/icons/web'
import { apiUrl } from '@/config/api'
import { uploadMerchantImage, removeMerchantImage, productImageSource } from '@/services/product-images'
import { useImageLocale, type ImageKey } from '../image-locale'

const props = defineProps<{ storeId: string; product: ProductRecordContract; disabled: boolean }>()
const emit = defineEmits<{ dirty: [boolean] }>()
const { t } = useImageLocale()
const hintId = useId()
const file = ref<File>()
const preview = ref('')
const removing = ref(false)
const error = ref<ImageKey>()
const broken = ref(false)
const input = ref<InstanceType<typeof FileInput>>()
const uploadButton = ref<InstanceType<typeof IconButton>>()
const current = computed(() => productImageSource(props.product.image_url, apiUrl('/'), window.location.href))
const source = computed(() => removing.value ? '' : preview.value || current.value)
const hasPreview = computed(() => !!source.value && !broken.value)
const dirty = computed(() => !!file.value || removing.value)
const unavailable = computed(() => props.disabled || props.product.configuration_version === undefined)

watch(dirty, value => emit('dirty', value), { immediate: true })
watch(source, () => { broken.value = false })

let requestId = ''
let requestVersion: number | undefined

function clear() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  file.value = undefined
  removing.value = false
  error.value = undefined
  requestId = ''
  requestVersion = undefined
  input.value?.clear()
}

function choose(files: FileList | null) {
  const selected = files?.[0]
  if (!selected || unavailable.value) return
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

  clear()
  file.value = selected
  preview.value = URL.createObjectURL(selected)
  requestId = crypto.randomUUID()
}

function changeSelection() {
  if (dirty.value) {
    clear()
    if (!props.product.image_url) uploadButton.value?.$el.focus()
    return
  }

  clear()
  removing.value = true
  requestId = crypto.randomUUID()
}

async function save(version: number) {
  if (!dirty.value) throw new Error('catalog.imageRequired')
  requestVersion ??= version
  const result = file.value
    ? await uploadMerchantImage(props.storeId, props.product.id, file.value, requestId, requestVersion)
    : await removeMerchantImage(props.storeId, props.product.id, requestId, requestVersion)
  clear()
  return result
}

onBeforeUnmount(() => {
  if (preview.value) URL.revokeObjectURL(preview.value)
  emit('dirty', false)
})
defineExpose({ save })
</script>

<template>
  <section class="grid min-w-0 gap-3">
    <h3 class="text-sm font-semibold">{{ t('title') }}</h3>
    <div
      class="image-preview relative grid aspect-square w-full max-w-68 place-items-center"
      :class="hasPreview ? 'has-preview' : 'border border-dashed bg-muted/30'"
      @dragover.prevent
      @drop.prevent="choose($event.dataTransfer?.files ?? null)"
    >
      <img
        v-if="hasPreview"
        :src="source"
        :alt="t(file ? 'preview' : 'current')"
        class="absolute inset-0 size-full object-contain"
        @error="broken = true"
      />
      <p v-else role="status" class="px-3 text-center text-sm text-muted-foreground">
        {{ t(removing ? 'pendingRemoval' : broken ? 'unavailable' : 'empty') }}
      </p>
      <div class="image-actions absolute end-2 top-2 flex gap-1.5">
        <IconButton
          ref="uploadButton"
          :icon="Upload"
          :label="t(hasPreview || broken ? 'replace' : 'choose')"
          :aria-describedby="hintId"
          :disabled="unavailable"
          variant="outline"
          class="bg-card"
          @click="input?.$el.click()"
        />
        <IconButton
          v-if="dirty || product.image_url"
          :icon="removing ? Undo2 : file ? X : Trash2"
          :label="t(removing ? 'keep' : file ? 'cancel' : 'remove')"
          :disabled="unavailable"
          variant="outline"
          class="bg-card"
          @click="changeSelection"
        />
      </div>
      <FileInput
        ref="input"
        accept="image/jpeg,image/png,image/webp"
        class="sr-only"
        :disabled="unavailable"
        tabindex="-1"
        aria-hidden="true"
        @select="choose"
      />
      <span :id="hintId" class="sr-only">{{ t('hint') }}</span>
      <p v-if="file" role="status" class="sr-only">{{ file.name }}</p>
    </div>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ t(error) }}</p>
  </section>
</template>

<style scoped>
@media (hover: hover) and (pointer: fine) {
  .image-preview.has-preview:not(:hover):not(:focus-within) .image-actions {
    opacity: 0;
    pointer-events: none;
  }
}
</style>
