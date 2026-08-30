<template>
  <el-dialog
    :model-value="open"
    title="商品配置"
    width="1200px"
    top="4vh"
    destroy-on-close
    @close="$emit('update:open', false)"
  >
    <div v-if="draft" class="config-dialog">
      <div class="dialog-intro">
        <div>
          <h3>{{ product?.name }}</h3>
          <p>{{ product?.description || '暂无商品描述' }}</p>
        </div>
        <el-form-item label="商品类型" class="type-field">
          <el-select v-model="draft.type">
            <el-option label="普通商品" value="SINGLE" />
            <el-option label="套餐商品" value="PACKAGE" />
          </el-select>
        </el-form-item>
      </div>

      <ProductVariantsEditor
        :model-value="draft.variants"
        :current-default-index="defaultVariantIndex"
        @add-variant="addVariant"
        @remove-variant="removeVariant"
        @set-default="setDefaultVariant"
      />

      <ProductSelectionGroupsEditor
        :model-value="draft.selection_groups"
        :variants="draft.variants"
        :external-sku-choices="externalSkuChoices"
        @add-group="addGroup"
        @remove-group="removeGroup"
        @add-option="addOption"
        @remove-option="removeOption"
      />
    </div>

    <template #footer>
      <el-button @click="$emit('update:open', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElButton, ElDialog, ElFormItem, ElOption, ElSelect } from '@/components/ui/element-plus'
import { computed, ref, watch } from 'vue'
import ProductSelectionGroupsEditor from './ProductSelectionGroupsEditor.vue'
import ProductVariantsEditor from './ProductVariantsEditor.vue'
import {
  createProductConfigDraft,
  createProductVariant,
  createSelectionBinding,
  createSelectionOption,
  normalizeProductConfig,
} from '../product-config'
import type { ProductConfigForm, ProductRecord } from '../types'

const props = defineProps<{
  open: boolean
  product: ProductRecord | null
  saving: boolean
  externalSkuChoices: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  (event: 'save', value: ProductConfigForm): void
  (event: 'update:open', value: boolean): void
}>()

const draft = ref<ProductConfigForm | null>(null)

const defaultVariantIndex = computed(() =>
  draft.value?.variants.findIndex((variant) => variant.is_default) ?? -1,
)

watch(
  () => [props.open, props.product] as const,
  ([open, product]) => {
    if (!open || !product) {
      return
    }

    draft.value = createProductConfigDraft(product)
  },
  { immediate: true },
)

function addVariant() {
  draft.value?.variants.push(createProductVariant(draft.value.variants.length === 0))
}

function removeVariant(index: number) {
  if (!draft.value) {
    return
  }

  draft.value.variants.splice(index, 1)
  if (!draft.value.variants.some((variant) => variant.is_default) && draft.value.variants[0]) {
    draft.value.variants[0].is_default = true
  }
}

function setDefaultVariant(index: number) {
  if (!draft.value) {
    return
  }

  draft.value.variants.forEach((variant, currentIndex) => {
    variant.is_default = currentIndex === index
  })
}

function addGroup() {
  if (!draft.value) return
  draft.value.selection_groups.push(createSelectionBinding(draft.value.selection_groups.length))
}

function removeGroup(index: number) {
  draft.value?.selection_groups.splice(index, 1)
}

function addOption(groupIndex: number) {
  const group = draft.value?.selection_groups[groupIndex]
  if (!group) {
    return
  }

  group.group.options.push({
    ...createSelectionOption(),
    sort_order: group.group.options.length,
  })
}

function removeOption(groupIndex: number, optionIndex: number) {
  const group = draft.value?.selection_groups[groupIndex]
  if (!group) {
    return
  }

  group.group.options.splice(optionIndex, 1)
}

function submit() {
  if (draft.value) emit('save', normalizeProductConfig(draft.value))
}
</script>

<style scoped>
.config-dialog {
  display: grid;
  gap: 18px;
  max-height: 72vh;
  overflow-y: auto;
  padding-right: 4px;
}

.dialog-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dialog-intro h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.dialog-intro p {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  font-size: 14px;
}

.type-field {
  min-width: 180px;
}

@media (max-width: 720px) {
  .dialog-intro {
    display: grid;
  }
}
</style>
