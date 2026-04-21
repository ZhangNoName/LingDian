<template>
  <Card class="rounded-lg border-border/80 transition hover:border-primary/40">
    <CardHeader class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <CardTitle class="text-base">{{ product.name }}</CardTitle>
          <CardDescription class="mt-1 leading-6">{{ product.description }}</CardDescription>
        </div>
        <Badge :variant="product.badgeVariant">{{ product.tag }}</Badge>
      </div>
      <div class="flex flex-wrap gap-2">
        <Badge variant="outline">{{ product.category }}</Badge>
        <Badge variant="outline">库存 {{ product.stock }}</Badge>
      </div>
    </CardHeader>
    <CardContent class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs text-muted-foreground">单价</p>
        <p class="mt-1 text-2xl font-semibold text-foreground">¥ {{ product.price.toFixed(2) }}</p>
      </div>
      <Button class="rounded-md" @click="$emit('add', product)">加入</Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Button } from '@/baseComponents/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
import type { Product } from '../types'

defineProps<{
  product: Product
}>()

defineEmits<{
  (event: 'add', product: Product): void
}>()
</script>
