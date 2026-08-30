<template>
  <div class="products-page">
    <ProductMetricsGrid :metrics="metrics" />

    <AppFormTable title="商品管理" description="统一维护 SPU、SKU 与可扩展配置项结构">
      <template #headerActions>
        <el-button :icon="RefreshCw" :loading="loading" @click="refreshProducts">刷新</el-button>
      </template>

      <template #form>
        <AppForm :model="filters" :columns="2">
          <el-form-item label="搜索">
            <el-input
              v-model="filters.keyword"
              clearable
              placeholder="搜索商品 / 分类 / SKU"
              @keyup.enter="applyFilters"
            />
          </el-form-item>
          <el-form-item label="商品类型">
            <el-select v-model="filters.type" clearable placeholder="全部类型">
              <el-option label="普通商品" value="SINGLE" />
              <el-option label="套餐商品" value="PACKAGE" />
            </el-select>
          </el-form-item>
          <template #actions>
            <el-button type="primary" @click="applyFilters">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </template>
        </AppForm>
      </template>

      <AppTable>
        <el-table
          v-loading="loading"
          :data="products"
          row-key="id"
          class="products-table"
          empty-text="暂无商品数据"
          @expand-change="handleExpandChange"
        >
          <el-table-column type="expand" width="52">
            <template #default="{ row }">
              <div class="expand-grid">
                <section>
                  <div class="expand-title">规格列表</div>
                  <el-table :data="asProduct(row).skus" row-key="id" border empty-text="暂无 SKU">
                    <el-table-column prop="sku_name" label="规格名称" min-width="180" />
                    <el-table-column label="售价" width="160">
                      <template #default="{ row: sku }">
                        <el-input-number
                          :model-value="asSku(sku).price"
                          :min="0"
                          :precision="2"
                          :step="1"
                          controls-position="right"
                          @update:model-value="(value) => updateSkuDraftValue(asSku(sku), 'price', value)"
                          @focus="captureSkuValue(asSku(sku), 'price')"
                          @change="queueSkuChange(asSku(sku), 'price')"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="库存" width="160">
                      <template #default="{ row: sku }">
                        <el-input-number
                          :model-value="asSku(sku).stock_count"
                          :min="0"
                          :precision="0"
                          :step="1"
                          controls-position="right"
                          @update:model-value="(value) => updateSkuDraftValue(asSku(sku), 'stock_count', value)"
                          @focus="captureSkuValue(asSku(sku), 'stock_count')"
                          @change="queueSkuChange(asSku(sku), 'stock_count')"
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
                  <div v-if="getSelectionGroups(asProduct(row)).length === 0" class="empty-config">
                    暂无选择组配置
                  </div>
                  <div v-else class="selection-group-list">
                    <el-card
                      v-for="binding in getSelectionGroups(asProduct(row))"
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
            <template #default="{ row }">{{ asProduct(row).selection_group_count }}</template>
          </el-table-column>
          <el-table-column label="总库存" width="110">
            <template #default="{ row }">{{ getTotalStock(asProduct(row)) }}</template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="260" show-overflow-tooltip />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openConfigDialog(asProduct(row).id)">配置</el-button>
            </template>
          </el-table-column>
        </el-table>
      </AppTable>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        class="products-pagination"
        @current-change="fetchProducts"
        @size-change="handlePageSizeChange"
      />
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
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
  vLoading,
} from '@/components/ui/element-plus'
import '@/styles/element-plus-management'
import { RefreshCw } from '@lingdian/icons/web'
import AppForm from '@/components/form/AppForm.vue'
import AppFormTable from '@/components/form-table/AppFormTable.vue'
import AppTable from '@/components/table/AppTable.vue'
import {
  getMerchantProduct,
  getMerchantProductStats,
  listMerchantProducts,
  listMerchantSkuOptions,
  saveMerchantProductConfig,
  updateMerchantSkuPrice,
  updateMerchantSkuStock,
} from '@/services/products'
import ProductConfigDialog from './components/ProductConfigDialog.vue'
import ProductMetricsGrid from './components/ProductMetricsGrid.vue'
import {
  captureSkuValue,
  createPendingSkuChange,
  formatSkuValue,
  revertSkuChange,
  type PendingSkuChange,
  type SkuField,
} from './product-inline-edit'
import type {
  ProductConfigForm,
  ProductListRecord,
  ProductRecord,
  ProductSku,
  ProductSkuOption,
  ProductStats,
  ProductType,
} from './types'

const products = ref<ProductListRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const productStats = ref<ProductStats>({
  total_count: 0,
  active_count: 0,
  package_count: 0,
  sku_count: 0,
  selection_group_count: 0,
})
const externalSkuChoices = ref<ProductSkuOption[]>([])
const skuOptionsLoaded = ref(false)
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
const pendingChange = ref<PendingSkuChange | null>(null)
const configDialogOpen = ref(false)
const activeProductId = ref<string | null>(null)
const activeProduct = ref<ProductRecord | null>(null)
const loadingDetailIds = new Set<string>()
let listRequestSequence = 0
let configRequestSequence = 0
let statsRequestSequence = 0

const metrics = computed(() => {
  return [
    { label: '在售商品', value: productStats.value.active_count, note: `共 ${productStats.value.total_count} 个商品` },
    { label: '套餐商品', value: productStats.value.package_count, note: '可配置组件选择' },
    { label: 'SKU 规格', value: productStats.value.sku_count, note: '负责价格与库存' },
    { label: '选择组', value: productStats.value.selection_group_count, note: '支持辣度、去料、套餐选项' },
  ]
})

function asProduct(row: unknown) {
  return row as ProductListRecord
}

function asSku(row: unknown) {
  return row as ProductSku
}

function updateSkuDraftValue(sku: ProductSku, field: SkuField, value: number | undefined) {
  sku[field] = Number(value ?? 0)
}

function getTotalStock(product: ProductListRecord) {
  return product.skus
    .filter((sku) => sku.is_active)
    .reduce((sum, sku) => sum + sku.stock_count, 0)
}

function getSelectionGroups(product: ProductListRecord) {
  return product.selection_groups ?? []
}

async function fetchProducts() {
  const requestSequence = ++listRequestSequence
  loading.value = true

  try {
    const result = await listMerchantProducts({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filters.keyword,
      type: filters.type,
    })
    if (requestSequence !== listRequestSequence) return
    products.value = result.items
    total.value = result.total
  } catch (error) {
    if (requestSequence === listRequestSequence) {
      ElMessage.error(error instanceof Error ? error.message : '商品列表加载失败')
    }
  } finally {
    if (requestSequence === listRequestSequence) loading.value = false
  }
}

async function fetchProductStats() {
  const requestSequence = ++statsRequestSequence
  const result = await getMerchantProductStats()
  if (requestSequence === statsRequestSequence) productStats.value = result
}

async function fetchSkuOptions(force = false) {
  if (skuOptionsLoaded.value && !force) return
  externalSkuChoices.value = await listMerchantSkuOptions()
  skuOptionsLoaded.value = true
}

async function refreshProducts() {
  try {
    await Promise.all([fetchProducts(), fetchProductStats()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '商品元数据加载失败')
  }
}

async function loadProductDetail(productId: string) {
  const product = await getMerchantProduct(productId)
  const index = products.value.findIndex((item) => item.id === productId)
  if (index >= 0) {
    products.value[index] = {
      ...products.value[index],
      ...product,
      selection_group_count: product.selection_groups.length,
    }
  }
  return product
}

async function handleExpandChange(row: ProductListRecord, expanded: boolean | ProductListRecord[]) {
  const isExpanded = Array.isArray(expanded)
    ? expanded.some((item) => item.id === row.id)
    : expanded
  if (!isExpanded || row.selection_groups || loadingDetailIds.has(row.id)) return
  loadingDetailIds.add(row.id)
  try {
    await loadProductDetail(row.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '商品详情加载失败')
  } finally {
    loadingDetailIds.delete(row.id)
  }
}

function applyFilters() {
  page.value = 1
  void fetchProducts()
}

function resetFilters() {
  filters.keyword = ''
  filters.type = ''
  page.value = 1
  void fetchProducts()
}

function handlePageSizeChange() {
  page.value = 1
  void fetchProducts()
}

async function openConfigDialog(productId: string) {
  const requestSequence = ++configRequestSequence
  savingConfig.value = false

  try {
    const [product] = await Promise.all([loadProductDetail(productId), fetchSkuOptions()])
    if (requestSequence !== configRequestSequence) return
    activeProductId.value = productId
    activeProduct.value = product
    configDialogOpen.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '商品详情加载失败')
  }
}

async function saveProductConfig(payload: ProductConfigForm) {
  if (!activeProductId.value) {
    return
  }

  savingConfig.value = true

  try {
    const productId = activeProductId.value
    const product = await saveMerchantProductConfig(productId, payload)
    const index = products.value.findIndex((item) => item.id === product.id)
    if (index >= 0) {
      products.value[index] = {
        ...products.value[index],
        ...product,
        selection_group_count: product.selection_groups.length,
      }
    }
    activeProduct.value = product
    await Promise.allSettled([fetchProductStats(), fetchSkuOptions(true)])

    ElMessage.success('商品配置已保存')
    configDialogOpen.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '商品配置保存失败')
  } finally {
    savingConfig.value = false
  }
}

function queueSkuChange(sku: ProductSku, field: SkuField) {
  if (pendingChange.value) return
  pendingChange.value = createPendingSkuChange(sku, field)
  if (!pendingChange.value) return
  confirmVisible.value = true
}

async function confirmPendingChange() {
  if (!pendingChange.value) {
    return
  }

  const change = pendingChange.value
  savingInline.value = true

  try {
    if (change.field === 'price') await updateMerchantSkuPrice(change.sku.id, change.newValue)
    else await updateMerchantSkuStock(change.sku.id, change.newValue)

    ElMessage.success('SKU 已更新')
    clearPendingChange()
    await fetchProducts()
  } catch (error) {
    revertPendingChange()
    ElMessage.error(error instanceof Error ? error.message : 'SKU 更新失败')
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

  revertSkuChange(pendingChange.value)
  clearPendingChange()
}

function clearPendingChange() {
  pendingChange.value = null
  confirmVisible.value = false
}

function formatValue(field: SkuField, value: number) {
  return formatSkuValue(field, value)
}

onMounted(refreshProducts)
</script>

<style scoped>
.products-page {
  display: grid;
  gap: 20px;
}

.products-table {
  width: 100%;
}

.products-pagination {
  justify-content: flex-end;
  padding-top: 16px;
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
