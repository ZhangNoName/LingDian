<script setup lang="ts">
import { IconButton } from '@lingdian/console-ui/button'
import { DropdownMenu } from '@lingdian/console-ui/dropdown'
import { Moon, Sunny } from '@lingdian/icons/admin'
import { useTheme } from '../../theme/theme'

const theme = useTheme()
const themes = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
] as const

function selectTheme(value: string) {
  const preference = themes.find((item) => item.value === value)
  if (preference) theme.setPreference(preference.value)
}
</script>

<template>
  <DropdownMenu :items="themes" @select="selectTheme">
    <IconButton :icon="theme.resolvedTheme.value === 'dark' ? Moon : Sunny" label="切换主题" size="icon" />
  </DropdownMenu>
</template>
