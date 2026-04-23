<template>
  <div class="products-page">
    <section class="metrics-grid">
      <el-card v-for="metric in metrics" :key="metric.label" shadow="never" class="metric-card">
        <p class="metric-label">{{ metric.label }}</p>
        <p class="metric-value">{{ metric.value }}</p>
        <p class="metric-note">{{ metric.note }}</p>
      </el-card>
    </section>

    <section class="products-panel">
      <div class="panel-header">
        <div>
          <h2>商品管理</h2>
          <p>SPU 商品与 SKU 规格库存维护</p>
        </div>
        <div class="toolbar">
          <el-input
            v-model="keyword"
            clearable
            placeholder="搜索商品 / 分类 / SKU"
            class="search-input"
          />
          <el-button :icon="Refresh" :loading="loading" @click="fetchProducts">刷新</el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="filteredProducts"
        row-key="id"
        class="products-table"
        empty-text="暂无商品数据"
      >
        <el-table-column type="expand" width="52">
          <template #default="{ row }">
            <div class="sku-expand">
              <el-table :data="row.skus" row-key="id" border empty-text="暂无 SKU">
                <el-table-column prop="sku_name" label="规格名称" min-width="180" />
                <el-table-column label="售价" width="220">
                  <template #default="{ row: sku }">
                    <el-input-number
                      v-model="sku.price"
                      :min="0"
                      :precision="2"
                      :step="1"
                      controls-position="right"
                      @focus="captureOriginalValue(sku, 'price')"
                      @change="queueSkuChange(sku, 'price')"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="库存" width="220">
                  <template #default="{ row: sku }">
                    <el-input-number
                      v-model="sku.stock_count"
                      :min="0"
                      :precision="0"
                      :step="1"
                      controls-position="right"
                      @focus="captureOriginalValue(sku, 'stock_count')"
                      @change="queueSkuChange(sku, 'stock_count')"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="库存状态" width="140">
                  <template #default="{ row: sku }">
                    <el-tag :type="sku.stock_count > 0 ? 'success' : 'danger'" effect="light">
                      {{ sku.stock_count > 0 ? '可售' : '售罄' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="180" />
        <el-table-column prop="category" label="分类" width="160" />
        <el-table-column label="上架状态" width="140">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" effect="light">
              {{ row.is_active ? '上架中' : '未上架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="SKU 数" width="120">
          <template #default="{ row }">{{ row.skus.length }}</template>
        </el-table-column>
        <el-table-column label="总库存" width="140">
          <template #default="{ row }">{{ getTotalStock(row) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
      </el-table>
    </section>

    <el-dialog v-model="confirmVisible" title="确认修改 SKU" width="420px" @close="revertPendingChange">
      <p v-if="pendingChange" class="confirm-copy">
        将 {{ pendingChange.sku.sku_name }} 的{{ pendingChange.label }}从
        <strong>{{ formatValue(pendingChange.field, pendingChange.oldValue) }}</strong>
        修改为
        <strong>{{ formatValue(pendingChange.field, pendingChange.newValue) }}</strong>
      </p>
      <template #footer>
        <el-button @click="cancelPendingChange">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmPendingChange">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ElButton,
  ElCard,
  ElDialog,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

type SkuField = 'price' | 'stock_count'

interface ProductSku {
  id: string
  product_id: string
  sku_name: string
  price: number
  stock_count: number
  _originalPrice?: number
  _originalStock?: number
}

interface Product {
  id: string
  name: string
  description?: string
  is_active: boolean
  status: string
  category: string
  skus: ProductSku[]
}

interface PendingChange {
  sku: ProductSku
  field: SkuField
  label: string
  oldValue: number
  newValue: number
}

const products = ref<Product[]>([])
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)
const confirmVisible = ref(false)
const pendingChange = ref<PendingChange | null>(null)

const metrics = computed(() => {
  const activeCount = products.value.filter((product) => product.is_active).length
  const skuCount = products.value.reduce((sum, product) => sum + product.skus.length, 0)
  const totalStock = products.value.reduce((sum, product) => sum + getTotalStock(product), 0)
  const soldOutCount = products.value.reduce(
    (sum, product) => sum + product.skus.filter((sku) => sku.stock_count <= 0).length,
    0,
  )

  return [
    { label: '在售商品', value: activeCount, note: `共 ${products.value.length} 个 SPU` },
    { label: 'SKU 规格', value: skuCount, note: '支持独立定价和库存' },
    { label: '总库存', value: totalStock, note: '后台人工维护' },
    { label: '售罄 SKU', value: soldOutCount, note: '库存为 0 的规格' },
  ]
})

const filteredProducts = computed(() => {
  const text = keyword.value.trim().toLowerCase()

  if (!text) {
    return products.value
  }

  return products.value.filter((product) => {
    const haystack = [
      product.name,
      product.description,
      product.category,
      ...product.skus.map((sku) => sku.sku_name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(text)
  })
})

function getTotalStock(product: Product) {
  return product.skus.reduce((sum, sku) => sum + sku.stock_count, 0)
}

async function fetchProducts() {
  loading.value = true

  try {
    const response = await fetch('/api/products')

    if (!response.ok) {
      throw new Error('商品列表加载失败')
    }

    products.value = await response.json()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '商品列表加载失败')
  } finally {
    loading.value = false
  }
}

function captureOriginalValue(sku: ProductSku, field: SkuField) {
  if (field === 'price') {
    sku._originalPrice = sku.price
    return
  }

  sku._originalStock = sku.stock_count
}

function queueSkuChange(sku: ProductSku, field: SkuField) {
  if (pendingChange.value) {
    return
  }

  const oldValue = field === 'price' ? sku._originalPrice : sku._originalStock
  const newValue = sku[field]

  if (oldValue === undefined || Number(oldValue) === Number(newValue)) {
    return
  }

  pendingChange.value = {
    sku,
    field,
    label: field === 'price' ? '售价' : '库存',
    oldValue: Number(oldValue),
    newValue: Number(newValue),
  }
  confirmVisible.value = true
}

async function confirmPendingChange() {
  if (!pendingChange.value) {
    return
  }

  const change = pendingChange.value
  const endpoint = change.field === 'price' ? '/api/sku/update-price' : '/api/sku/update-stock'
  const payload =
    change.field === 'price'
      ? { sku_id: change.sku.id, price: change.newValue }
      : { sku_id: change.sku.id, stock_count: change.newValue }

  saving.value = true

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.message ?? 'SKU 修改失败')
    }

    ElMessage.success('SKU 已更新')
    clearPendingChange()
  } catch (error) {
    revertPendingChange()
    ElMessage.error(error instanceof Error ? error.message : 'SKU 修改失败')
  } finally {
    saving.value = false
  }
}

function cancelPendingChange() {
  revertPendingChange()
  confirmVisible.value = false
}

function revertPendingChange() {
  if (!pendingChange.value || saving.value) {
    return
  }

  pendingChange.value.sku[pendingChange.value.field] = pendingChange.value.oldValue
  clearPendingChange()
}

function clearPendingChange() {
  pendingChange.value = null
  confirmVisible.value = false
}

function formatValue(field: SkuField, value: number) {
  return field === 'price' ? `¥${value.toFixed(2)}` : `${value}`
}

onMounted(fetchProducts)
</script>

<style scoped>
.products-page {
  display: grid;
  gap: 20px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  border-radius: 8px;
}

.metric-label,
.metric-note {
  color: var(--muted-foreground);
  font-size: 13px;
}

.metric-value {
  margin-top: 10px;
  color: var(--foreground);
  font-size: 28px;
  font-weight: 700;
}

.metric-note {
  margin-top: 6px;
}

.products-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.panel-header p {
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.search-input {
  width: 280px;
}

.products-table {
  width: 100%;
}

.sku-expand {
  padding: 12px 28px 18px;
  background: #f8fbff;
}

.confirm-copy {
  margin: 0;
  line-height: 1.8;
}

@media (max-width: 1024px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    display: grid;
  }

  .toolbar,
  .search-input {
    width: 100%;
  }
}
</style>
