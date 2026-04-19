<template>
  <Card :class="cn('rounded-3xl border-border/80 shadow-sm', cardClass)">
    <CardHeader :class="cn('flex flex-col gap-2 md:flex-row md:items-start md:justify-between', headerClass)">
      <div>
        <CardTitle class="text-xl">{{ title }}</CardTitle>
        <CardDescription v-if="description" class="mt-1 leading-6">
          {{ description }}
        </CardDescription>
      </div>
      <slot name="actions" />
    </CardHeader>
    <CardContent :class="contentClass">
      <slot />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

defineProps<{
  title: string
  description?: string
  cardClass?: HTMLAttributes['class']
  headerClass?: HTMLAttributes['class']
  contentClass?: HTMLAttributes['class']
}>()
</script>
