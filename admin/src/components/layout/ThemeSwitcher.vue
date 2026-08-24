<script setup lang="ts">
import { Moon, Sunny } from '@lingdian/icons/admin'
import { useTheme, type ThemePreference } from '../../theme/theme'
const theme = useTheme()
</script>

<template>
  <el-dropdown trigger="click" @command="theme.setPreference($event as ThemePreference)">
    <el-button text circle aria-label="切换主题"><el-icon><Moon v-if="theme.resolvedTheme.value === 'dark'" /><Sunny v-else /></el-icon></el-button>
    <template #dropdown><el-dropdown-menu>
      <el-dropdown-item command="light">浅色</el-dropdown-item>
      <el-dropdown-item command="dark">深色</el-dropdown-item>
      <el-dropdown-item command="system">跟随系统</el-dropdown-item>
    </el-dropdown-menu></template>
  </el-dropdown>
</template>
