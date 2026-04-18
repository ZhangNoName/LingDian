<template>
  <div class="page-stack">
    <PageSection title="门店管理" description="管理门店基础信息、营业状态、服务方式和桌台码">
      <div class="toolbar-row">
        <div class="fake-search">搜索门店名称 / 编号 / 区域</div>
        <div class="toolbar-actions">
          <span class="toolbar-pill">营业中</span>
          <span class="toolbar-pill">自提开启</span>
          <button class="action-button">新建门店</button>
        </div>
      </div>

      <div class="table-card">
        <div class="table-row table-head">
          <span>门店</span>
          <span>状态</span>
          <span>服务方式</span>
          <span>今日订单</span>
          <span>操作</span>
        </div>
        <div v-for="store in stores" :key="store.name" class="table-row">
          <span>{{ store.name }}</span>
          <span>{{ store.status }}</span>
          <span>{{ store.mode }}</span>
          <span>{{ store.orders }}</span>
          <span class="action-link">查看详情</span>
        </div>
      </div>
    </PageSection>

    <div class="content-grid two-columns">
      <PageSection title="门店详情页应包含" description="建议作为二级页细化字段与权限">
        <ul class="detail-list">
          <li>基础资料、地址、联系人、营业时间</li>
          <li>堂食 / 外带 / 自提配置</li>
          <li>配送规则、桌台码、封面图与公告</li>
          <li>关联菜单、关联活动、打印设备绑定</li>
        </ul>
      </PageSection>

      <PageSection title="扩展页面" description="门店模块后续可以继续拆分的独立界面">
        <div class="chip-wrap">
          <span class="mini-chip">门店详情</span>
          <span class="mini-chip">营业设置</span>
          <span class="mini-chip">桌台码管理</span>
          <span class="mini-chip">配送配置</span>
          <span class="mini-chip">节假日设置</span>
        </div>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'

const stores = [
  { name: '陆家嘴示范店', status: '营业中', mode: '堂食 / 自提 / 外带', orders: '286' },
  { name: '徐汇日月光店', status: '备餐高峰', mode: '堂食 / 自提', orders: '194' },
  { name: '虹桥商务店', status: '暂停接单', mode: '堂食', orders: '38' },
]
</script>
