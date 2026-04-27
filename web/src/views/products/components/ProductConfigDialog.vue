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
import { ElButton, ElDialog, ElFormItem, ElOption, ElSelect } from 'element-plus'
import { computed, ref, watch } from 'vue'
import ProductSelectionGroupsEditor from './ProductSelectionGroupsEditor.vue'
import ProductVariantsEditor from './ProductVariantsEditor.vue'
import type {
  ProductConfigForm,
  ProductRecord,
  ProductSelectionBindingForm,
  ProductSelectionGroupForm,
  ProductVariantForm,
  SelectionOptionForm,
} from '../types'

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

    draft.value = {
      type: product.type,
      variants: product.skus.map((sku) => ({
        id: sku.id,
        sku_name: sku.sku_name,
        price: sku.price,
        stock_count: sku.stock_count,
        is_default: sku.is_default,
        is_active: sku.is_active,
      })),
      selection_groups: product.selection_groups.map((binding) => ({
        id: binding.binding_id,
        scope: binding.scope,
        target_variant_id: binding.target_variant_id ?? undefined,
        sort_order: binding.sort_order,
        is_enabled: binding.is_enabled,
        group: {
          id: binding.group.id,
          name: binding.group.name,
          group_type: binding.group.group_type,
          selection_mode: binding.group.selection_mode,
          min_select: binding.group.min_select,
          max_select: binding.group.max_select,
          is_required: binding.group.is_required,
          is_active: binding.group.is_active,
          sort_order: binding.group.sort_order,
          description: binding.group.description ?? '',
          options: binding.group.options.map((option) => ({
            id: option.id,
            name: option.name,
            option_type: option.option_type,
            price_delta: option.price_delta,
            stock_delta: option.stock_delta,
            is_default: option.is_default,
            is_active: option.is_active,
            sort_order: option.sort_order,
            referenced_sku_id: option.referenced_sku_id ?? undefined,
          })),
        },
      })),
    }
  },
  { immediate: true },
)

function createVariant(): ProductVariantForm {
  return {
    sku_name: '',
    price: 0,
    stock_count: 0,
    is_default: draft.value?.variants.length === 0,
    is_active: true,
  }
}

function createOption(): SelectionOptionForm {
  return {
    name: '',
    option_type: 'VALUE',
    price_delta: 0,
    stock_delta: 0,
    is_default: false,
    is_active: true,
    sort_order: 0,
  }
}

function createGroup(): ProductSelectionBindingForm {
  const nextIndex = draft.value?.selection_groups.length ?? 0
  const group: ProductSelectionGroupForm = {
    name: '',
    group_type: 'MODIFIER',
    selection_mode: 'SINGLE',
    min_select: 0,
    max_select: 1,
    is_required: false,
    is_active: true,
    sort_order: nextIndex,
    description: '',
    options: [createOption()],
  }

  return {
    scope: 'PRODUCT',
    sort_order: nextIndex,
    is_enabled: true,
    group,
  }
}

function addVariant() {
  draft.value?.variants.push(createVariant())
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
  draft.value?.selection_groups.push(createGroup())
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
    ...createOption(),
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

function normalizeDraft() {
  if (!draft.value) {
    return null
  }

  return {
    type: draft.value.type,
    variants: draft.value.variants.map((variant, index) => ({
      ...variant,
      is_default: variant.is_default || index === 0,
    })),
    selection_groups: draft.value.selection_groups.map((binding, bindingIndex) => ({
      ...binding,
      sort_order: bindingIndex,
      group: {
        ...binding.group,
        sort_order: bindingIndex,
        description: binding.group.description || '',
        options: binding.group.options.map((option, optionIndex) => ({
          ...option,
          sort_order: optionIndex,
        })),
      },
    })),
  }
}

function submit() {
  const payload = normalizeDraft()
  if (!payload) {
    return
  }

  emit('save', payload)
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
