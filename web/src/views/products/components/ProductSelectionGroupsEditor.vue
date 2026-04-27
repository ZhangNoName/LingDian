<template>
  <section class="editor-section">
    <div class="section-header">
      <div>
        <h4>配置项结构</h4>
        <p>普通商品和套餐都通过选择组建模，支持口味、去料、套餐组件等。</p>
      </div>
      <el-button type="primary" plain @click="$emit('add-group')">新增选择组</el-button>
    </div>

    <el-empty v-if="modelValue.length === 0" description="暂无选择组配置" />

    <div v-else class="group-list">
      <el-card v-for="(binding, bindingIndex) in modelValue" :key="`${binding.id ?? 'new'}-${bindingIndex}`" shadow="never">
        <template #header>
          <div class="group-card-header">
            <span>{{ binding.group.name || `选择组 ${bindingIndex + 1}` }}</span>
            <el-button link type="danger" @click="$emit('remove-group', bindingIndex)">删除</el-button>
          </div>
        </template>

        <div class="group-grid">
          <el-form-item label="绑定范围">
            <el-select v-model="binding.scope">
              <el-option label="商品级" value="PRODUCT" />
              <el-option label="规格级" value="VARIANT" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="binding.scope === 'VARIANT'" label="绑定规格">
            <el-select v-model="binding.target_variant_id" placeholder="选择一个 SKU">
              <el-option
                v-for="variant in selectableVariants"
                :key="variant.id"
                :label="variant.sku_name || '未命名规格'"
                :value="variant.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="组名称">
            <el-input v-model="binding.group.name" placeholder="如：辣度 / 饮料选择" />
          </el-form-item>
          <el-form-item label="组类型">
            <el-select v-model="binding.group.group_type">
              <el-option label="附加项" value="MODIFIER" />
              <el-option label="套餐组件" value="COMPONENT" />
            </el-select>
          </el-form-item>
          <el-form-item label="选择模式">
            <el-select v-model="binding.group.selection_mode">
              <el-option label="单选" value="SINGLE" />
              <el-option label="多选" value="MULTIPLE" />
            </el-select>
          </el-form-item>
          <el-form-item label="最少选择">
            <el-input-number v-model="binding.group.min_select" :min="0" :precision="0" />
          </el-form-item>
          <el-form-item label="最多选择">
            <el-input-number v-model="binding.group.max_select" :min="0" :precision="0" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="binding.sort_order" :min="0" :precision="0" />
          </el-form-item>
          <el-form-item label="组状态">
            <div class="switch-row">
              <span>必选</span>
              <el-switch v-model="binding.group.is_required" />
              <span>启用</span>
              <el-switch v-model="binding.is_enabled" />
            </div>
          </el-form-item>
          <el-form-item label="说明" class="description-field">
            <el-input v-model="binding.group.description" placeholder="可选，补充规则说明" />
          </el-form-item>
        </div>

        <div class="options-header">
          <h5>选择项</h5>
          <el-button size="small" @click="$emit('add-option', bindingIndex)">新增选项</el-button>
        </div>

        <el-table :data="binding.group.options" border empty-text="暂无选项">
          <el-table-column label="名称" min-width="180">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="如：不要生菜 / 可乐中杯" />
            </template>
          </el-table-column>
          <el-table-column label="类型" width="140">
            <template #default="{ row }">
              <el-select v-model="row.option_type">
                <el-option label="普通值" value="VALUE" />
                <el-option label="引用 SKU" value="VARIANT" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="引用规格" min-width="200">
            <template #default="{ row }">
              <el-select
                v-if="row.option_type === 'VARIANT'"
                v-model="row.referenced_sku_id"
                placeholder="选择引用的 SKU"
              >
                <el-option
                  v-for="choice in referenceChoices"
                  :key="choice.value"
                  :label="choice.label"
                  :value="choice.value"
                />
              </el-select>
              <span v-else class="muted-text">普通值选项</span>
            </template>
          </el-table-column>
          <el-table-column label="加价" width="140">
            <template #default="{ row }">
              <el-input-number v-model="row.price_delta" :min="0" :precision="2" :step="1" />
            </template>
          </el-table-column>
          <el-table-column label="默认" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.is_default" />
            </template>
          </el-table-column>
          <el-table-column label="启用" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.is_active" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" @click="$emit('remove-option', bindingIndex, $index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElEmpty,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus'
import { computed } from 'vue'
import type { ProductSelectionBindingForm, ProductVariantForm } from '../types'

const props = defineProps<{
  modelValue: ProductSelectionBindingForm[]
  variants: ProductVariantForm[]
  externalSkuChoices: Array<{ value: string; label: string }>
}>()

defineEmits<{
  (event: 'add-group'): void
  (event: 'remove-group', index: number): void
  (event: 'add-option', groupIndex: number): void
  (event: 'remove-option', groupIndex: number, optionIndex: number): void
}>()

const referenceChoices = computed(() => [
  ...props.variants
    .filter((variant): variant is ProductVariantForm & { id: string } => Boolean(variant.id))
    .map((variant) => ({
      value: variant.id,
      label: `当前商品 / ${variant.sku_name}`,
    })),
  ...props.externalSkuChoices,
])

const selectableVariants = computed(() =>
  props.variants.filter((variant): variant is ProductVariantForm & { id: string } => Boolean(variant.id)),
)
</script>

<style scoped>
.editor-section {
  display: grid;
  gap: 12px;
}

.section-header,
.group-card-header,
.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-header h4,
.options-header h5 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.section-header p {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.group-list {
  display: grid;
  gap: 12px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin-bottom: 16px;
}

.description-field {
  grid-column: 1 / -1;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.options-header {
  margin-bottom: 10px;
}

.muted-text {
  color: var(--muted-foreground);
  font-size: 13px;
}

@media (max-width: 720px) {
  .section-header,
  .group-card-header,
  .options-header {
    display: grid;
  }

  .group-grid {
    grid-template-columns: 1fr;
  }
}
</style>
