<template>
  <Card class="rounded-3xl border-border/80 shadow-sm">
    <CardHeader class="pb-3">
      <CardDescription>{{ label }}</CardDescription>
      <CardTitle class="text-3xl">{{ value }}</CardTitle>
    </CardHeader>
    <CardContent>
      <p class="text-sm text-primary">{{ trend }}</p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

defineProps<{
  label: string
  value: string
  trend: string
}>()
</script>
