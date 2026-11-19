<template>
  <Card class="border-border/80">
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
import { Badge } from '@lingdian/console-ui/badge'
import { Card, CardContent } from '@lingdian/console-ui/card'
</script>
