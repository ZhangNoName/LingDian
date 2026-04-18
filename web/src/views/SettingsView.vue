<template>
  <div class="page-stack">
    <PageSection title="系统设置" description="账号权限、设备配置、通知和品牌主题设置">
      <div class="content-grid two-columns">
        <div class="surface-subcard">
          <p class="subcard-label">角色数量</p>
          <p class="subcard-value">9</p>
        </div>
        <div class="surface-subcard">
          <p class="subcard-label">打印设备在线</p>
          <p class="subcard-value">26 / 29</p>
        </div>
      </div>
    </PageSection>

    <PageSection title="建议设置页">
      <div class="chip-wrap">
        <span class="mini-chip">账号列表</span>
        <span class="mini-chip">角色管理</span>
        <span class="mini-chip">权限配置</span>
        <span class="mini-chip">打印设备</span>
        <span class="mini-chip">消息通知</span>
        <span class="mini-chip">品牌主题</span>
        <span class="mini-chip">操作日志</span>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'
</script>
