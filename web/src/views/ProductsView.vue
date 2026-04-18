<template>
  <div class="page-stack">
    <PageSection title="商品与菜单" description="覆盖商品、分类、套餐、规格、库存和上下架管理">
      <div class="stats-grid compact">
        <article v-for="metric in metrics" :key="metric.label" class="stat-card">
          <p class="stat-label">{{ metric.label }}</p>
          <p class="stat-value">{{ metric.value }}</p>
        </article>
      </div>
    </PageSection>

    <div class="content-grid two-columns">
      <PageSection title="商品列表页" description="建议作为商品管理的默认首页">
        <div class="list-rows">
          <div v-for="item in products" :key="item.name" class="list-row">
            <div>
              <p class="list-title">{{ item.name }}</p>
              <p class="list-text">{{ item.meta }}</p>
            </div>
            <span class="pill">{{ item.price }}</span>
          </div>
        </div>
      </PageSection>

      <PageSection title="商品模块页面清单" description="对应 Web PRD 的核心页面划分">
        <div class="chip-wrap">
          <span class="mini-chip">商品列表</span>
          <span class="mini-chip">商品编辑</span>
          <span class="mini-chip">商品详情</span>
          <span class="mini-chip">分类管理</span>
          <span class="mini-chip">菜单管理</span>
          <span class="mini-chip">套餐管理</span>
          <span class="mini-chip">规格与加料</span>
          <span class="mini-chip">库存状态</span>
        </div>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'

const metrics = [
  { label: '在售商品', value: '186' },
  { label: '分类数量', value: '24' },
  { label: '套餐数量', value: '18' },
  { label: '售罄商品', value: '7' },
]

const products = [
  { name: '炙烤鸡腿饭', meta: '主食 / 招牌 / 已上架 / 门店 18 家', price: '¥29.9' },
  { name: '黑椒牛肉意面', meta: '西式 / 新品 / 晚市菜单', price: '¥32.0' },
  { name: '双人分享套餐', meta: '套餐 / 活动商品 / 热销', price: '¥58.8' },
]
</script>
