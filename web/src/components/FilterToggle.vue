<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'

defineProps<{ controls: string }>()
const open = defineModel<boolean>({ required: true })
</script>

<template>
  <Button type="button" variant="outline" :aria-controls="controls" :aria-expanded="open" @click="open = !open">
    <slot />
  </Button>
</template>
