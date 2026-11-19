<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <CollapsibleRoot v-model:open="open">
    <CollapsibleTrigger as-child><slot name="trigger" /></CollapsibleTrigger>
    <CollapsibleContent><slot /></CollapsibleContent>
  </CollapsibleRoot>
</template>
