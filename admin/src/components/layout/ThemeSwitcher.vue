<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'
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
    <Button type="button" variant="ghost" size="icon" aria-label="切换主题">
      <Moon v-if="theme.resolvedTheme.value === 'dark'" />
      <Sunny v-else />
    </Button>
  </DropdownMenu>
</template>
