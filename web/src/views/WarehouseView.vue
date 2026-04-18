<template>
  <div class="page-stack">
    <PageSection title="仓库管理" description="承接原料库存、采购、入库、出库、调拨和盘点">
      <div class="content-grid two-columns">
        <div class="surface-subcard">
          <p class="subcard-label">低库存原料</p>
          <p class="subcard-value">12</p>
        </div>
        <div class="surface-subcard">
          <p class="subcard-label">待入库采购单</p>
          <p class="subcard-value">5</p>
        </div>
      </div>
    </PageSection>

    <div class="content-grid two-columns">
      <PageSection title="仓储页面清单">
        <div class="chip-wrap">
          <span class="mini-chip">仓库列表</span>
          <span class="mini-chip">库存商品</span>
          <span class="mini-chip">入库单</span>
          <span class="mini-chip">出库单</span>
          <span class="mini-chip">调拨单</span>
          <span class="mini-chip">盘点单</span>
          <span class="mini-chip">损耗记录</span>
          <span class="mini-chip">采购单</span>
          <span class="mini-chip">供应商管理</span>
        </div>
      </PageSection>

      <PageSection title="库存页建议字段">
        <ul class="detail-list">
          <li>原料名称、编码、单位、当前库存</li>
          <li>安全库存、最近入库时间、仓库位置</li>
          <li>状态、近 7 日出库量、操作入口</li>
        </ul>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'
</script>
