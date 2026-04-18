<template>
  <div class="page-stack">
    <section class="hero-panel">
      <div>
        <p class="hero-kicker">今日经营总览</p>
        <h2 class="hero-title">先把门店、订单、库存和营销信号集中到一个工作台里。</h2>
        <p class="hero-description">
          当前版本用于承接管理后台信息架构，后续可继续接入真实接口、图表和权限控制。
        </p>
      </div>
      <div class="hero-tag">P0 页面骨架已完成</div>
    </section>

    <div class="stats-grid">
      <article v-for="card in cards" :key="card.label" class="stat-card">
        <p class="stat-label">{{ card.label }}</p>
        <p class="stat-value">{{ card.value }}</p>
        <p class="stat-trend">{{ card.trend }}</p>
      </article>
    </div>

    <div class="content-grid two-columns">
      <PageSection title="待办中心" description="适合后续接入异常订单、退款审核、低库存提醒">
        <div class="list-rows">
          <div v-for="item in todos" :key="item.title" class="list-row">
            <div>
              <p class="list-title">{{ item.title }}</p>
              <p class="list-text">{{ item.detail }}</p>
            </div>
            <span class="pill">{{ item.level }}</span>
          </div>
        </div>
      </PageSection>

      <PageSection title="快捷入口" description="对应后台首期建议优先建设的核心功能">
        <div class="quick-grid">
          <div v-for="shortcut in shortcuts" :key="shortcut.title" class="quick-card">
            <p class="quick-title">{{ shortcut.title }}</p>
            <p class="quick-text">{{ shortcut.text }}</p>
          </div>
        </div>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'

const cards = [
  { label: '今日销售额', value: '¥ 28,640', trend: '较昨日 +12.4%' },
  { label: '有效订单', value: '1,284', trend: '堂食占比 41%' },
  { label: '退款单量', value: '19', trend: '退款率 1.48%' },
  { label: '低库存预警', value: '12', trend: '需尽快补货' },
]

const todos = [
  { title: '退款待审核', detail: '当前有 6 笔订单等待店长处理。', level: '高优' },
  { title: '门店暂停营业', detail: '浦东陆家嘴店设置为今日 20:30 提前打烊。', level: '提醒' },
  { title: '库存不足', detail: '鸡腿原料库存低于安全线，影响 3 个 SKU。', level: '紧急' },
]

const shortcuts = [
  { title: '商品管理', text: '快速进入商品、分类、套餐和上下架管理。' },
  { title: '订单中心', text: '处理堂食、自提、售后与订单异常。' },
  { title: '仓库管理', text: '查看入库、出库、盘点、采购与供应商。' },
  { title: '统计分析', text: '查看销售趋势、爆品排行和活动效果。' },
]
</script>
