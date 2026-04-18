<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="brand-block">
      <div class="brand-mark">LD</div>
      <div v-if="!collapsed">
        <p class="brand-title">零点管理后台</p>
        <p class="brand-subtitle">餐饮点餐一体化工作台</p>
      </div>
    </div>

    <nav class="nav-list">
      <RouterLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        active-class="active"
        :title="collapsed ? item.label : ''"
      >
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="!collapsed" class="nav-caption">{{ item.caption }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { navigationItems } from '../config/navigation'

defineProps<{
  collapsed: boolean
}>()
</script>
