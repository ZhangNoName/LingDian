<template>
  <div class="orders-page">
    <OrderMetricsGrid :metrics="metrics" />

    <AppFormTable title="订单管理" description="统一查看订单状态、金额、餐品明细与完整流转轨迹。">
      <template #headerActions>
        <el-button :icon="Refresh" :loading="loading" @click="fetchOrders">刷新</el-button>
      </template>

      <template #form>
        <AppForm :model="filters" :columns="5">
          <el-form-item label="关键词">
            <el-input
              v-model="filters.keyword"
              clearable
              placeholder="搜索订单号 / 顾客 / 手机号 / 备注"
            />
          </el-form-item>

          <el-form-item label="订单状态">
            <el-select v-model="filters.status" clearable placeholder="全部状态">
              <el-option
                v-for="option in statusOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="订单类型">
            <el-select v-model="filters.orderType" clearable placeholder="全部类型">
              <el-option
                v-for="option in orderTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="支付渠道">
            <el-select v-model="filters.paymentChannel" clearable placeholder="全部渠道">
              <el-option
                v-for="option in paymentChannelOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="日期区间">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              range-separator="至"
              class="full-width"
            />
          </el-form-item>

          <template #actions>
            <el-button @click="resetFilters">重置</el-button>
            <el-button type="primary" :loading="loading" @click="fetchOrders">查询</el-button>
          </template>
        </AppForm>
      </template>

      <AppTable>
        <el-table
          v-loading="loading"
          :data="orders"
          row-key="id"
          class="orders-table"
          empty-text="暂无订单数据"
        >
          <el-table-column prop="order_no" label="订单号" min-width="180" />
          <el-table-column prop="customer_name" label="顾客" width="120" />
          <el-table-column prop="customer_mobile" label="手机号" width="140" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag effect="plain">{{ orderTypeLabel(row.order_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="支付渠道" width="120">
            <template #default="{ row }">
              {{ paymentChannelLabel(row.payment_channel) }}
            </template>
          </el-table-column>
          <el-table-column label="订单状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" effect="light">
                {{ statusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="餐品摘要" min-width="280">
            <template #default="{ row }">
              <div class="item-summary">
                <p v-for="item in row.item_summary.slice(0, 2)" :key="item.id">
                  {{ item.name }}
                  <template v-if="item.sku_name"> / {{ item.sku_name }}</template>
                  x{{ item.quantity }}
                </p>
                <span v-if="row.item_summary.length > 2">
                  另含 {{ row.item_summary.length - 2 }} 项
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120">
            <template #default="{ row }">¥{{ row.payable_amount.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column label="创建时间" width="176">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="更新时间" width="176">
            <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openOrderDetail(row.id)">查看详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </AppTable>
    </AppFormTable>

    <OrderDetailDialog
      v-model:open="detailDialogOpen"
      v-model:action-note="actionNote"
      :actions="detailActions"
      :can-delete="canDeleteOrder"
      :deleting="deletingOrder"
      :loading="detailLoading"
      :order="activeOrder"
      :saving-status="savingStatus"
      @change-status="handleStatusChange"
      @delete-order="handleDeleteOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ElButton,
  ElDatePicker,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
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
import OrderDetailDialog from './components/OrderDetailDialog.vue'
import OrderMetricsGrid from './components/OrderMetricsGrid.vue'
import type {
  OrderDetail,
  OrderFilters,
  OrderListItem,
  OrderStatus,
  OrderStatusAction,
  OrderSummaryMetric,
  OrderSummaryResponse,
  OrderType,
  PaymentChannel,
} from './types'

const loading = ref(false)
const detailLoading = ref(false)
const deletingOrder = ref(false)
const savingStatus = ref<OrderStatus | null>(null)
const orders = ref<OrderListItem[]>([])
const activeOrder = ref<OrderDetail | null>(null)
const detailDialogOpen = ref(false)
const actionNote = ref('')
const summary = ref<OrderSummaryResponse>({
  total_count: 0,
  pending_payment_count: 0,
  paid_count: 0,
  refunding_count: 0,
  refunded_count: 0,
  total_amount: 0,
})

const filters = reactive<OrderFilters>({
  keyword: '',
  status: '',
  orderType: '',
  paymentChannel: '',
  dateRange: [],
})

const statusOptions: Array<{ label: string; value: OrderStatus }> = [
  { label: '创建中', value: 'CREATING' },
  { label: '待支付', value: 'PENDING_PAYMENT' },
  { label: '已支付', value: 'PAID' },
  { label: '制作中', value: 'PREPARING' },
  { label: '待取餐', value: 'READY' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已超时', value: 'TIMED_OUT' },
  { label: '退款中', value: 'REFUNDING' },
  { label: '已退款', value: 'REFUNDED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '失败', value: 'FAILED' },
  { label: '已删除', value: 'DELETED' },
]

const orderTypeOptions: Array<{ label: string; value: OrderType }> = [
  { label: '堂食', value: 'DINE_IN' },
  { label: '外卖', value: 'TAKEOUT' },
  { label: '自取', value: 'PICKUP' },
]

const paymentChannelOptions: Array<{ label: string; value: PaymentChannel }> = [
  { label: '现金', value: 'CASH' },
  { label: '微信', value: 'WECHAT' },
  { label: '支付宝', value: 'ALIPAY' },
  { label: '对方扫码', value: 'CUSTOMER_SCAN' },
  { label: '其他', value: 'OTHER' },
]

const metrics = computed<OrderSummaryMetric[]>(() => [
  { label: '订单总数', value: summary.value.total_count, note: '当前筛选范围内的订单量' },
  { label: '待支付', value: summary.value.pending_payment_count, note: '需要尽快确认付款' },
  { label: '已支付', value: summary.value.paid_count, note: '进入履约或已完成阶段' },
  { label: '退款中', value: summary.value.refunding_count, note: '需要跟进退款处理结果' },
  { label: '已退款', value: summary.value.refunded_count, note: '已完成退款闭环' },
  {
    label: '累计金额',
    value: `¥${summary.value.total_amount.toFixed(2)}`,
    note: '已支付及退款相关订单金额',
  },
])

const detailActions = computed<OrderStatusAction[]>(() => {
  const status = activeOrder.value?.status

  if (!status) {
    return []
  }

  const actionsByStatus: Record<OrderStatus, OrderStatusAction[]> = {
    CREATING: [
      { label: '转待支付', value: 'PENDING_PAYMENT', type: 'primary' },
      { label: '标记取消', value: 'CANCELLED', type: 'warning' },
      { label: '标记失败', value: 'FAILED', type: 'danger' },
    ],
    PENDING_PAYMENT: [
      { label: '标记已支付', value: 'PAID', type: 'success' },
      { label: '标记超时', value: 'TIMED_OUT', type: 'warning' },
      { label: '取消订单', value: 'CANCELLED', type: 'info' },
      { label: '标记失败', value: 'FAILED', type: 'danger' },
    ],
    PAID: [
      { label: '进入制作', value: 'PREPARING', type: 'primary' },
      { label: '待取餐', value: 'READY', type: 'primary' },
      { label: '已完成', value: 'COMPLETED', type: 'success' },
      { label: '发起退款', value: 'REFUNDING', type: 'warning' },
      { label: '直接退款', value: 'REFUNDED', type: 'danger' },
    ],
    PREPARING: [
      { label: '待取餐', value: 'READY', type: 'primary' },
      { label: '已完成', value: 'COMPLETED', type: 'success' },
      { label: '发起退款', value: 'REFUNDING', type: 'warning' },
      { label: '直接退款', value: 'REFUNDED', type: 'danger' },
    ],
    READY: [
      { label: '已完成', value: 'COMPLETED', type: 'success' },
      { label: '发起退款', value: 'REFUNDING', type: 'warning' },
      { label: '直接退款', value: 'REFUNDED', type: 'danger' },
    ],
    COMPLETED: [
      { label: '发起退款', value: 'REFUNDING', type: 'warning' },
      { label: '直接退款', value: 'REFUNDED', type: 'danger' },
    ],
    TIMED_OUT: [],
    REFUNDING: [
      { label: '退款完成', value: 'REFUNDED', type: 'danger' },
      { label: '标记失败', value: 'FAILED', type: 'warning' },
    ],
    REFUNDED: [],
    CANCELLED: [],
    FAILED: [],
    DELETED: [],
  }

  return actionsByStatus[status]
})

const canDeleteOrder = computed(() => {
  const status = activeOrder.value?.status
  return ['CANCELLED', 'TIMED_OUT', 'FAILED', 'REFUNDED', 'COMPLETED'].includes(status ?? '')
})

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status: OrderStatus) {
  return (
    {
      CREATING: '创建中',
      PENDING_PAYMENT: '待支付',
      PAID: '已支付',
      PREPARING: '制作中',
      READY: '待取餐',
      COMPLETED: '已完成',
      TIMED_OUT: '已超时',
      REFUNDING: '退款中',
      REFUNDED: '已退款',
      CANCELLED: '已取消',
      FAILED: '失败',
      DELETED: '已删除',
    }[status] ?? status
  )
}

function statusTagType(
  status: OrderStatus,
): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const typeMap: Record<OrderStatus, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    CREATING: 'info',
    PENDING_PAYMENT: 'warning',
    PAID: 'success',
    PREPARING: 'warning',
    READY: 'primary',
    COMPLETED: 'success',
    TIMED_OUT: 'info',
    REFUNDING: 'warning',
    REFUNDED: 'danger',
    CANCELLED: 'info',
    FAILED: 'danger',
    DELETED: 'info',
  }

  return typeMap[status]
}

function orderTypeLabel(type: OrderType) {
  return (
    {
      DINE_IN: '堂食',
      TAKEOUT: '外卖',
      PICKUP: '自取',
    }[type] ?? type
  )
}

function paymentChannelLabel(channel: PaymentChannel) {
  return (
    {
      CASH: '现金',
      WECHAT: '微信',
      ALIPAY: '支付宝',
      CUSTOMER_SCAN: '对方扫码',
      OTHER: '其他',
    }[channel] ?? channel
  )
}

function buildQueryParams() {
  const params = new URLSearchParams()

  if (filters.keyword.trim()) {
    params.set('keyword', filters.keyword.trim())
  }

  if (filters.status) {
    params.set('status', filters.status)
  }

  if (filters.orderType) {
    params.set('orderType', filters.orderType)
  }

  if (filters.paymentChannel) {
    params.set('paymentChannel', filters.paymentChannel)
  }

  if (filters.dateRange.length === 2) {
    const [start, end] = filters.dateRange
    const startDate = new Date(start)
    const endDate = new Date(end)
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)
    params.set('startDate', startDate.toISOString())
    params.set('endDate', endDate.toISOString())
  }

  return params.toString()
}

async function fetchOrders() {
  loading.value = true

  try {
    const query = buildQueryParams()
    const [summaryData, listData] = await Promise.all([
      requestData<OrderSummaryResponse>(`/api/orders/summary${query ? `?${query}` : ''}`),
      requestData<OrderListItem[]>(`/api/orders${query ? `?${query}` : ''}`),
    ])

    summary.value = summaryData
    orders.value = listData
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '订单数据加载失败')
  } finally {
    loading.value = false
  }
}

async function openOrderDetail(orderId: string) {
  detailDialogOpen.value = true
  detailLoading.value = true
  actionNote.value = ''

  try {
    activeOrder.value = await requestData<OrderDetail>(`/api/orders/${orderId}`)
  } catch (error) {
    detailDialogOpen.value = false
    ElMessage.error(error instanceof Error ? error.message : '订单详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

async function handleStatusChange(status: OrderStatus) {
  if (!activeOrder.value) {
    return
  }

  savingStatus.value = status

  try {
    activeOrder.value = await requestData<OrderDetail>(`/api/orders/${activeOrder.value.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        operatorName: '订单后台',
        note: actionNote.value.trim() || undefined,
      }),
    })

    actionNote.value = ''
    ElMessage.success(`订单已更新为${statusLabel(status)}`)
    await fetchOrders()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '状态变更失败')
  } finally {
    savingStatus.value = null
  }
}

async function handleDeleteOrder() {
  if (!activeOrder.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      '删除后订单不会物理移除，但会被标记为已删除并从默认列表中隐藏。是否继续？',
      '删除订单',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  deletingOrder.value = true

  try {
    activeOrder.value = await requestData<OrderDetail>(`/api/orders/${activeOrder.value.id}?operatorName=订单后台`, {
      method: 'DELETE',
    })
    ElMessage.success('订单已标记为删除')
    await fetchOrders()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除订单失败')
  } finally {
    deletingOrder.value = false
  }
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.orderType = ''
  filters.paymentChannel = ''
  filters.dateRange = []
  void fetchOrders()
}

onMounted(fetchOrders)
</script>

<style scoped>
.orders-page {
  display: grid;
  gap: 20px;
}

.orders-table {
  width: 100%;
}

.item-summary {
  display: grid;
  gap: 4px;
}

.item-summary p,
.item-summary span {
  margin: 0;
  color: #546274;
  line-height: 1.6;
}

.full-width {
  width: 100%;
}
</style>
