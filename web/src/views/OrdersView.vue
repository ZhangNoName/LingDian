<template>
  <div class="page-stack">
    <PageSection title="订单中心" description="处理订单列表、订单详情、履约状态、售后与退款">
      <div class="chip-wrap">
        <span class="mini-chip">全部订单</span>
        <span class="mini-chip">堂食订单</span>
        <span class="mini-chip">自提订单</span>
        <span class="mini-chip">退款审核</span>
        <span class="mini-chip">异常订单</span>
        <span class="mini-chip">出餐工作台</span>
      </div>
    </PageSection>

    <div class="content-grid two-columns">
      <PageSection title="订单列表页字段建议">
        <div class="table-card">
          <div class="table-row table-head">
            <span>订单号</span>
            <span>门店</span>
            <span>类型</span>
            <span>状态</span>
            <span>金额</span>
          </div>
          <div v-for="order in orders" :key="order.no" class="table-row">
            <span>{{ order.no }}</span>
            <span>{{ order.store }}</span>
            <span>{{ order.type }}</span>
            <span>{{ order.status }}</span>
            <span>{{ order.amount }}</span>
          </div>
        </div>
      </PageSection>

      <PageSection title="订单详情页需要承接的内容">
        <ul class="detail-list">
          <li>订单基础信息、用户信息、门店信息</li>
          <li>商品明细、规格、加料、备注、优惠明细</li>
          <li>支付信息、履约记录、操作日志</li>
          <li>退款发起、售后处理、补打小票、重新叫号</li>
        </ul>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'

const orders = [
  { no: 'LD202604180001', store: '陆家嘴示范店', type: '堂食', status: '制作中', amount: '¥58.8' },
  { no: 'LD202604180019', store: '徐汇日月光店', type: '自提', status: '待取餐', amount: '¥29.9' },
  { no: 'LD202604180021', store: '虹桥商务店', type: '外带', status: '退款审核', amount: '¥42.0' },
]
</script>
