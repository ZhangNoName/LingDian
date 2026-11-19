<script setup lang="ts">
import { Alert } from '@lingdian/console-ui/alert'
import { Button } from '@lingdian/console-ui/button'

defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <Alert>
    {{ message }}
    <Button type="button" variant="link" @click="$emit('retry')">重试</Button>
  </Alert>
</template>
