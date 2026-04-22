<template>
  <Card
    class="cursor-pointer select-none rounded-lg border transition-colors"
    :class="
      inCart
        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20 hover:bg-primary/10'
        : 'border-border/80 bg-card hover:border-primary/50 hover:bg-amber-100'
    "
    @click="$emit('add', product)"
  >
    <CardHeader class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <CardTitle
            class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base"
          >
            <span>{{ product.name }}</span>
            <span class="text-sm font-normal text-muted-foreground">
              {{ product.stock }}
            </span>
          </CardTitle>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <Badge :variant="product.badgeVariant">{{ product.tag }}</Badge>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Badge variant="outline">{{ product.category }}</Badge>
      </div>
    </CardHeader>
    <CardContent class="flex items-end justify-between gap-3">
      <div>
        <p class="mt-1 text-2xl font-semibold text-foreground">
          {{ product.price }}
        </p>
      </div>
      <div
        v-if="quantity > 0"
        class="flex h-9 shrink-0 items-center overflow-hidden rounded-md border border-primary/50 bg-background shadow-sm"
        @click.stop
      >
        <button
          type="button"
          class="flex size-9 items-center justify-center border-r border-primary/20 text-lg leading-none text-primary transition hover:bg-primary/10"
          @click="$emit('decrease', product.id)"
        >
          -
        </button>
        <span class="min-w-9 px-2 text-center text-sm font-semibold">
          {{ quantity }}
        </span>
        <button
          type="button"
          class="flex size-9 items-center justify-center border-l border-primary/20 text-lg leading-none text-primary transition hover:bg-primary/10"
          @click="$emit('increase', product.id)"
        >
          +
        </button>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/baseComponents/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/baseComponents/card";
import type { Product } from "../types";

defineProps<{
  inCart: boolean;
  product: Product;
  quantity: number;
}>();

defineEmits<{
  (event: "add", product: Product): void;
  (event: "decrease", id: string): void;
  (event: "increase", id: string): void;
}>();
</script>
