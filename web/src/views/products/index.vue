<template>
  <div class="products-page">
    <ProductMetricsGrid :metrics="metrics" />

    <AppFormTable title="商品管理" description="统一维护 SPU、SKU 与可扩展配置项结构">
      <template #headerActions>
        <el-button :icon="Refresh" :loading="loading" @click="fetchProducts">刷新</el-button>
      </template>

      <template #form>
        <AppForm :model="filters" :columns="2">
          <el-form-item label="搜索">
            <el-input
              v-model="filters.keyword"
              clearable
              placeholder="搜索商品 / 分类 / SKU / 选择组"
            />
          </el-form-item>
          <el-form-item label="商品类型">
            <el-select v-model="filters.type" clearable placeholder="全部类型">
              <el-option label="普通商品" value="SINGLE" />
              <el-option label="套餐商品" value="PACKAGE" />
            </el-select>
          </el-form-item>
        </AppForm>
      </template>

      <AppTable>
        <el-table
          v-loading="loading"
          :data="filteredProducts"
          row-key="id"
          class="products-table"
          empty-text="暂无商品数据"
        >
          <el-table-column type="expand" width="52">
            <template #default="{ row }">
              <div class="expand-grid">
                <section>
                  <div class="expand-title">规格列表</div>
                  <el-table :data="row.skus" row-key="id" border empty-text="暂无 SKU">
                    <el-table-column prop="sku_name" label="规格名称" min-width="180" />
                    <el-table-column label="售价" width="160">
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
                    <el-table-column label="库存" width="160">
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
                    <el-table-column label="默认" width="90">
                      <template #default="{ row: sku }">
                        <el-tag v-if="sku.is_default" type="success" effect="light">默认</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="状态" width="100">
                      <template #default="{ row: sku }">
                        <el-tag :type="sku.is_active ? 'success' : 'info'" effect="light">
                          {{ sku.is_active ? '启用' : '停用' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                  </el-table>
                </section>

                <section>
                  <div class="expand-title">配置项结构</div>
                  <div v-if="row.selection_groups.length === 0" class="empty-config">
                    暂无选择组配置
                  </div>
                  <div v-else class="selection-group-list">
                    <el-card
                      v-for="binding in row.selection_groups"
                      :key="binding.binding_id"
                      shadow="never"
                      class="selection-card"
                    >
                      <div class="selection-card__header">
                        <div>
                          <strong>{{ binding.group.name }}</strong>
                          <p>
                            {{ binding.group.group_type === 'COMPONENT' ? '套餐组件' : '附加项' }}
                            ·
                            {{ binding.group.selection_mode === 'SINGLE' ? '单选' : '多选' }}
                            ·
                            {{ binding.scope === 'PRODUCT' ? '商品级' : '规格级' }}
                          </p>
                        </div>
                        <el-tag :type="binding.group.is_required ? 'warning' : 'info'" effect="light">
                          {{ binding.group.is_required ? '必选' : '可选' }}
                        </el-tag>
                      </div>
                      <div class="selection-card__meta">
                        最少 {{ binding.group.min_select }} 项 / 最多 {{ binding.group.max_select }} 项
                      </div>
                      <ul class="option-list">
                        <li v-for="option in binding.group.options" :key="option.id">
                          <span>{{ option.name }}</span>
                          <span class="option-meta">
                            <template v-if="option.option_type === 'VARIANT'">
                              引用 {{ option.referenced_product_name }} / {{ option.referenced_sku_name }}
                            </template>
                            <template v-else>普通值</template>
                            <template v-if="option.price_delta > 0"> · +¥{{ option.price_delta.toFixed(2) }}</template>
                          </span>
                        </li>
                      </ul>
                    </el-card>
                  </div>
                </section>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="商品名称" min-width="180" />
          <el-table-column prop="category" label="分类" width="160" />
          <el-table-column label="商品类型" width="120">
            <template #default="{ row }">
              <el-tag :type="row.type === 'PACKAGE' ? 'warning' : 'success'" effect="light">
                {{ row.type === 'PACKAGE' ? '套餐' : '普通商品' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上架状态" width="120">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" effect="light">
                {{ row.is_active ? '上架中' : '未上架' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="SKU 数" width="90">
            <template #default="{ row }">{{ row.skus.length }}</template>
          </el-table-column>
          <el-table-column label="选择组" width="90">
            <template #default="{ row }">{{ row.selection_groups.length }}</template>
          </el-table-column>
          <el-table-column label="总库存" width="110">
            <template #default="{ row }">{{ getTotalStock(row) }}</template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="260" show-overflow-tooltip />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openConfigDialog(row.id)">配置</el-button>
            </template>
          </el-table-column>
        </el-table>
      </AppTable>
    </AppFormTable>

    <ProductConfigDialog
      :open="configDialogOpen"
      :product="activeProduct"
      :saving="savingConfig"
      :external-sku-choices="externalSkuChoices"
      @save="saveProductConfig"
      @update:open="configDialogOpen = $event"
    />

    <el-dialog v-model="confirmVisible" title="确认修改 SKU" width="420px" @close="revertPendingChange">
      <p v-if="pendingChange" class="confirm-copy">
        将 {{ pendingChange.sku.sku_name }} 的{{ pendingChange.label }}从
        <strong>{{ formatValue(pendingChange.field, pendingChange.oldValue) }}</strong>
        修改为
        <strong>{{ formatValue(pendingChange.field, pendingChange.newValue) }}</strong>
      </p>
      <template #footer>
        <el-button @click="cancelPendingChange">取消</el-button>
        <el-button type="primary" :loading="savingInline" @click="confirmPendingChange">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ElButton,
  ElCard,
  ElDialog,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import AppForm from '@/components/form/AppForm.vue'
import AppFormTable from '@/components/form-table/AppFormTable.vue'
import AppTable from '@/components/table/AppTable.vue'
import { requestData } from '@/lib/api'
import ProductConfigDialog from './components/ProductConfigDialog.vue'
import ProductMetricsGrid from './components/ProductMetricsGrid.vue'
import type { ProductConfigForm, ProductRecord, ProductSku, ProductType } from './types'

type SkuField = 'price' | 'stock_count'

interface PendingChange {
  sku: ProductSku
  field: SkuField
  label: string
  oldValue: number
  newValue: number
}

const products = ref<ProductRecord[]>([])
const filters = reactive<{
  keyword: string
  type: ProductType | ''
}>({
  keyword: '',
  type: '',
})
const loading = ref(false)
const savingInline = ref(false)
const savingConfig = ref(false)
const confirmVisible = ref(false)
const pendingChange = ref<PendingChange | null>(null)
const configDialogOpen = ref(false)
const activeProductId = ref<string | null>(null)

const activeProduct = computed(() =>
  products.value.find((product) => product.id === activeProductId.value) ?? null,
)

const metrics = computed(() => {
  const activeCount = products.value.filter((product) => product.is_active).length
  const packageCount = products.value.filter((product) => product.type === 'PACKAGE').length
  const skuCount = products.value.reduce((sum, product) => sum + product.skus.length, 0)
  const selectionGroupCount = products.value.reduce(
    (sum, product) => sum + product.selection_groups.length,
    0,
  )

  return [
    { label: '在售商品', value: activeCount, note: `共 ${products.value.length} 个商品` },
    { label: '套餐商品', value: packageCount, note: '可配置组件选择' },
    { label: 'SKU 规格', value: skuCount, note: '负责价格与库存' },
    { label: '选择组', value: selectionGroupCount, note: '支持辣度、去料、套餐选项' },
  ]
})

const filteredProducts = computed(() => {
  const text = filters.keyword.trim().toLowerCase()

  return products.value.filter((product) => {
    const matchesType = !filters.type || product.type === filters.type
    const haystack = [
      product.name,
      product.description,
      product.category,
      ...product.skus.map((sku) => sku.sku_name),
      ...product.selection_groups.map((group) => group.group.name),
      ...product.selection_groups.flatMap((group) => group.group.options.map((option) => option.name)),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const matchesKeyword = !text || haystack.includes(text)
    return matchesType && matchesKeyword
  })
})

const externalSkuChoices = computed(() =>
  products.value.flatMap((product) =>
    product.skus.map((sku) => ({
      value: sku.id,
      label: `${product.name} / ${sku.sku_name}`,
    })),
  ),
)

function getTotalStock(product: ProductRecord) {
  return product.skus
    .filter((sku) => sku.is_active)
    .reduce((sum, sku) => sum + sku.stock_count, 0)
}

async function fetchProducts() {
  loading.value = true

  try {
    products.value = await requestData<ProductRecord[]>('/api/products')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Product list load failed')
  } finally {
    loading.value = false
  }
}

async function openConfigDialog(productId: string) {
  savingConfig.value = false

  try {
    const product = await requestData<ProductRecord>(`/api/products/${productId}`)
    const index = products.value.findIndex((item) => item.id === productId)
    if (index >= 0) {
      products.value[index] = product
    } else {
      products.value.push(product)
    }

    activeProductId.value = productId
    configDialogOpen.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Product detail load failed')
  }
}

async function saveProductConfig(payload: ProductConfigForm) {
  if (!activeProductId.value) {
    return
  }

  savingConfig.value = true

  try {
    const product = await requestData<ProductRecord>(`/api/products/${activeProductId.value}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const index = products.value.findIndex((item) => item.id === product.id)
    if (index >= 0) {
      products.value[index] = product
    }

    ElMessage.success('Product config saved')
    configDialogOpen.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Product config save failed')
  } finally {
    savingConfig.value = false
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

  savingInline.value = true

  try {
    await requestData<unknown>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    ElMessage.success('SKU updated')
    clearPendingChange()
    await fetchProducts()
  } catch (error) {
    revertPendingChange()
    ElMessage.error(error instanceof Error ? error.message : 'SKU update failed')
  } finally {
    savingInline.value = false
  }
}

function cancelPendingChange() {
  revertPendingChange()
  confirmVisible.value = false
}

function revertPendingChange() {
  if (!pendingChange.value || savingInline.value) {
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

.products-table {
  width: 100%;
}

.expand-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 16px;
  padding: 12px 20px 18px;
  background: #f8fbff;
}

.expand-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
}

.selection-group-list {
  display: grid;
  gap: 10px;
}

.selection-card {
  border-radius: 8px;
}

.selection-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.selection-card__header p,
.selection-card__meta {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.option-list {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding-left: 18px;
}

.option-meta {
  color: var(--muted-foreground);
  font-size: 12px;
}

.empty-config,
.confirm-copy {
  color: var(--muted-foreground);
  line-height: 1.8;
}

@media (max-width: 1024px) {
  .expand-grid {
    grid-template-columns: 1fr;
  }
}
</style>
