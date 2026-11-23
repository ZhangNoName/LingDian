<script setup lang="ts">
import { IconButton } from '@lingdian/console-ui/button'
import { Download, RefreshCw } from '@lingdian/icons/web'

defineProps<{ action: 'refresh' | 'export'; label: string }>()
</script>

<template>
  <IconButton :icon="action === 'refresh' ? RefreshCw : Download" :label="label" variant="outline" size="icon" />
</template>
