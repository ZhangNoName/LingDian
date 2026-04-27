<template>
  <section class="editor-section">
    <div class="section-header">
      <div>
        <h4>规格配置</h4>
        <p>会影响价格和库存的规格保留在 SKU 层。</p>
      </div>
      <el-button type="primary" plain @click="$emit('add-variant')">新增规格</el-button>
    </div>

    <el-table :data="modelValue" border empty-text="暂无规格，请至少添加一个规格">
      <el-table-column label="默认" width="96">
        <template #default="{ $index }">
          <el-radio :model-value="currentDefaultIndex" :label="$index" @change="$emit('set-default', $index)">
            默认
          </el-radio>
        </template>
      </el-table-column>
      <el-table-column label="规格名称" min-width="180">
        <template #default="{ row }">
          <el-input v-model="row.sku_name" placeholder="如：单品 / 双层 / 大杯" />
        </template>
      </el-table-column>
      <el-table-column label="售价" width="160">
        <template #default="{ row }">
          <el-input-number v-model="row.price" :min="0" :precision="2" :step="1" />
        </template>
      </el-table-column>
      <el-table-column label="库存" width="160">
        <template #default="{ row }">
          <el-input-number v-model="row.stock_count" :min="0" :precision="0" :step="1" />
        </template>
      </el-table-column>
      <el-table-column label="启用" width="110">
        <template #default="{ row }">
          <el-switch v-model="row.is_active" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ $index }">
          <el-button link type="danger" @click="$emit('remove-variant', $index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElInput,
  ElInputNumber,
  ElRadio,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus'
import type { ProductVariantForm } from '../types'

defineProps<{
  modelValue: ProductVariantForm[]
  currentDefaultIndex: number
}>()

defineEmits<{
  (event: 'add-variant'): void
  (event: 'remove-variant', index: number): void
  (event: 'set-default', index: number): void
}>()
</script>

<style scoped>
.editor-section {
  display: grid;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.section-header p {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

@media (max-width: 720px) {
  .section-header {
    display: grid;
  }
}
</style>
