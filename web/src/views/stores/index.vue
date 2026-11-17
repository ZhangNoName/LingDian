<script setup lang="ts">
import { computed } from 'vue'
import { merchantStore } from '@/auth/merchant-store'
import { useLocale } from '@/i18n/locale'
const { locale } = useLocale()
const english = computed(() => locale.value === 'en-US')
const store = computed(() => merchantStore.stores.value.find((candidate) => candidate.id === merchantStore.selectedId.value))
const status = computed(() => store.value ? {
  OPEN: english.value ? 'Open' : '营业中',
  CLOSED: english.value ? 'Closed' : '已关闭',
  RESTING: english.value ? 'Resting' : '暂停营业',
}[store.value.status] : '')
</script>

<template>
  <section v-if="store" class="rounded-lg border bg-card p-5">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div><h2 class="text-xl font-semibold">{{ store.name }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ english ? 'Selected store' : '当前门店' }}</p></div>
      <span class="rounded-md border px-3 py-1 text-sm">{{ status }}</span>
    </div>
    <dl class="mt-5 grid gap-5 sm:grid-cols-2">
      <div><dt class="text-sm text-muted-foreground">{{ english ? 'Store code' : '门店编码' }}</dt><dd class="mt-2 font-mono text-sm">{{ store.code }}</dd></div>
      <div><dt class="text-sm text-muted-foreground">{{ english ? 'Authorized stores' : '已授权门店' }}</dt><dd class="mt-2 text-sm">{{ merchantStore.stores.value.length }}</dd></div>
    </dl>
    <p class="mt-6 text-sm leading-6 text-muted-foreground">{{ english ? 'Use the store selector above to switch stores. Products, orders, inventory and integrations follow the selected store.' : '通过顶部门店选择器切换门店。商品、订单、库存和集成配置随当前门店切换。' }}</p>
  </section>
</template>
