<template>
  <PageSection title="财务结算" description="承接支付流水、退款记录、门店结算、对账和发票管理。">
    <div class="flex flex-wrap gap-2">
      <Badge variant="outline">支付流水</Badge>
      <Badge variant="outline">退款记录</Badge>
      <Badge variant="outline">门店结算</Badge>
      <Badge variant="outline">对账</Badge>
      <Badge variant="outline">发票管理</Badge>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import { Badge } from '@/components/ui/badge'
</script>
