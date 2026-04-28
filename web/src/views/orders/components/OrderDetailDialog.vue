<template>
  <el-dialog
    :model-value="open"
    title="订单详情"
    width="960px"
    top="4vh"
    destroy-on-close
    @update:model-value="$emit('update:open', $event)"
  >
    <div v-if="loading" class="detail-loading">正在加载订单详情...</div>
    <div v-else-if="order" class="detail-layout">
      <section class="detail-block">
        <header class="detail-block__header">
          <div>
            <h3>{{ order.order_no }}</h3>
            <p>{{ order.store_name }} · {{ order.customer_name }} / {{ order.customer_mobile }}</p>
          </div>
          <div class="detail-block__tags">
            <el-tag :type="statusTagType(order.status)" effect="light">
              {{ statusLabel(order.status) }}
            </el-tag>
            <el-tag effect="plain">{{ orderTypeLabel(order.order_type) }}</el-tag>
            <el-tag effect="plain">{{ paymentChannelLabel(order.payment_channel) }}</el-tag>
          </div>
        </header>

        <div class="detail-meta">
          <div>
            <span>创建时间</span>
            <strong>{{ formatDateTime(order.created_at) }}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{{ formatDateTime(order.updated_at) }}</strong>
          </div>
          <div>
            <span>订单金额</span>
            <strong>¥{{ order.total_amount.toFixed(2) }}</strong>
          </div>
          <div>
            <span>应付金额</span>
            <strong>¥{{ order.payable_amount.toFixed(2) }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <div class="detail-block">
          <div class="section-title">订单餐品</div>
          <div class="item-list">
            <article v-for="item in order.items" :key="item.id" class="item-card">
              <div class="item-card__top">
                <div>
                  <strong>{{ item.product_name }}</strong>
                  <p v-if="item.sku_name">{{ item.sku_name }}</p>
                </div>
                <div class="item-card__price">
                  x{{ item.quantity }} · ¥{{ item.subtotal.toFixed(2) }}
                </div>
              </div>
              <p class="item-card__unit">单价 ¥{{ item.unit_price.toFixed(2) }}</p>
              <p v-if="item.remark" class="item-card__remark">备注：{{ item.remark }}</p>
              <ul v-if="item.selections.length" class="item-card__selection-list">
                <li v-for="selection in item.selections" :key="selection.id">
                  {{ selection.group_name }} / {{ selection.option_name }}
                  <span>
                    x{{ selection.quantity }}
                    <template v-if="selection.price_delta > 0">
                      · +¥{{ selection.price_delta.toFixed(2) }}
                    </template>
                  </span>
                </li>
              </ul>
            </article>
          </div>
          <div v-if="order.remark" class="order-remark">订单备注：{{ order.remark }}</div>
        </div>

        <div class="detail-block">
          <div class="section-title">状态时间线</div>
          <el-timeline>
            <el-timeline-item
              v-for="log in timelineLogs"
              :key="log.id"
              :timestamp="formatDateTime(log.created_at)"
              :type="timelineType(log.to_status)"
            >
              <div class="timeline-title">{{ statusLabel(log.to_status) }}</div>
              <p class="timeline-copy">
                <template v-if="log.from_status">
                  由 {{ statusLabel(log.from_status) }} 变更为 {{ statusLabel(log.to_status) }}
                </template>
                <template v-else>订单初始化为 {{ statusLabel(log.to_status) }}</template>
              </p>
              <p v-if="log.operator_name" class="timeline-copy">操作人：{{ log.operator_name }}</p>
              <p v-if="log.note" class="timeline-copy">说明：{{ log.note }}</p>
            </el-timeline-item>
          </el-timeline>
        </div>
      </section>

      <section class="detail-block">
        <div class="section-title">订单操作</div>
        <div class="action-toolbar">
          <el-button
            v-for="action in actions"
            :key="action.value"
            :type="action.type ?? 'primary'"
            plain
            :loading="savingStatus === action.value"
            @click="$emit('change-status', action.value)"
          >
            {{ action.label }}
          </el-button>
          <el-button
            v-if="canDelete"
            type="danger"
            plain
            :loading="deleting"
            @click="$emit('delete-order')"
          >
            删除订单
          </el-button>
        </div>

        <el-input
          :model-value="actionNote"
          type="textarea"
          :rows="3"
          placeholder="可选：填写本次状态变更说明，例如付款渠道补录、退款原因、取消说明"
          @update:model-value="$emit('update:actionNote', String($event))"
        />
      </section>
    </div>

    <template #footer>
      <el-button @click="$emit('update:open', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ElButton,
  ElDialog,
  ElInput,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus'
import type { OrderDetail, OrderStatus, OrderStatusAction, OrderType, PaymentChannel } from '../types'

const props = defineProps<{
  open: boolean
  loading: boolean
  order: OrderDetail | null
  actions: OrderStatusAction[]
  actionNote: string
  savingStatus: OrderStatus | null
  deleting: boolean
  canDelete: boolean
}>()

defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'update:actionNote', value: string): void
  (event: 'change-status', value: OrderStatus): void
  (event: 'delete-order'): void
}>()

const timelineLogs = computed(() => [...(props.order?.status_logs ?? [])].reverse())

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
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
    READY: 'success',
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

function timelineType(
  status: OrderStatus,
): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const typeMap: Partial<Record<OrderStatus, 'primary' | 'success' | 'warning' | 'danger' | 'info'>> = {
    PAID: 'success',
    COMPLETED: 'success',
    REFUNDING: 'warning',
    REFUNDED: 'danger',
    CANCELLED: 'warning',
    FAILED: 'danger',
  }

  return typeMap[status] ?? 'primary'
}
</script>

<style scoped>
.detail-loading {
  padding: 48px 0;
  text-align: center;
  color: var(--muted-foreground);
}

.detail-layout {
  display: grid;
  gap: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 16px;
}

.detail-block {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid #dce7f2;
  border-radius: 14px;
  background: #fbfdff;
}

.detail-block__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.detail-block__header h3,
.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #142033;
}

.detail-block__header p,
.timeline-copy,
.item-card__unit,
.item-card__remark,
.order-remark {
  margin: 0;
  color: #627082;
  line-height: 1.7;
}

.detail-block__tags,
.action-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.detail-meta div {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f3f8fd;
}

.detail-meta span {
  color: #667587;
  font-size: 12px;
}

.detail-meta strong {
  color: #162236;
  font-size: 15px;
}

.item-list {
  display: grid;
  gap: 12px;
}

.item-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 12px;
  background: white;
  border: 1px solid #e7eef5;
}

.item-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.item-card__top p {
  margin: 4px 0 0;
  color: #667587;
}

.item-card__price {
  color: #163255;
  font-weight: 600;
}

.item-card__selection-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: #516071;
}

.timeline-title {
  font-weight: 700;
  color: #162236;
}

@media (max-width: 960px) {
  .detail-grid,
  .detail-meta {
    grid-template-columns: 1fr;
  }

  .detail-block__header {
    display: grid;
  }
}
</style>
