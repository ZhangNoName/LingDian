<template>
  <Card class="rounded-lg border-border/80">
    <CardHeader>
      <CardTitle class="text-xl">财务结算</CardTitle>
      <CardDescription class="mt-1 leading-6">承接支付流水、退款记录、门店结算、对账和发票管理。</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="flex flex-wrap gap-2">
        <Badge variant="outline">支付流水</Badge>
        <Badge variant="outline">退款记录</Badge>
        <Badge variant="outline">门店结算</Badge>
        <Badge variant="outline">对账</Badge>
        <Badge variant="outline">发票管理</Badge>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
</script>
