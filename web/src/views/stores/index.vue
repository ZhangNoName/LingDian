<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Badge } from '@lingdian/console-ui/badge'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { merchantStore } from '@/auth/merchant-store'
import { useLocale } from '@/i18n/locale'
import { getStoreStatusPresentation } from './store-view'
const { locale } = useLocale(),
  english = computed(() => locale.value === 'en-US'),
  store = computed(() =>
    merchantStore.stores.value.find((candidate) => candidate.id === merchantStore.selectedId.value),
  ),
  status = computed(() => (store.value ? getStoreStatusPresentation(store.value.status, locale.value).label : ''))
</script>
<template>
  <Card v-if="store" class="min-w-0 gap-0 p-5" :lang="locale">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div class="min-w-0">
        <h2 class="break-words text-xl font-semibold">{{ store.name }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ english ? 'Selected store' : '当前门店' }}</p>
      </div>
      <Badge variant="outline" class="h-6 px-3">{{ status }}</Badge>
    </div>
    <dl class="mt-5 grid gap-5 sm:grid-cols-2">
      <div>
        <dt class="text-sm text-muted-foreground">{{ english ? 'Store code' : '门店编码' }}</dt>
        <dd class="mt-2 break-all font-mono text-sm">{{ store.code }}</dd>
      </div>
      <div>
        <dt class="text-sm text-muted-foreground">{{ english ? 'Authorized stores' : '已授权门店' }}</dt>
        <dd class="mt-2 text-sm">{{ merchantStore.stores.value.length.toLocaleString(locale) }}</dd>
      </div>
    </dl>
    <p class="mt-6 text-sm leading-6 text-muted-foreground">
      {{
        english
          ? 'Use the header selector to switch stores. Products, orders, inventory and integrations follow the selected store.'
          : '通过顶部门店选择器切换门店。商品、订单、库存和集成配置随当前门店切换。'
      }}
    </p>
    <p class="mt-3 text-sm leading-6 text-muted-foreground">
      {{
        english
          ? 'Store details and opening settings are read-only here. Contact your platform administrator for changes.'
          : '门店基础资料和营业配置在此只读。如需修改，请联系平台管理员。'
      }}
    </p>
    <div class="mt-5 flex flex-wrap gap-3">
      <Button as-child variant="outline">
        <RouterLink to="/products">{{ english ? 'Products & menu' : '商品与菜单' }}</RouterLink>
      </Button>
      <Button as-child variant="outline">
        <RouterLink to="/warehouse">{{ english ? 'Inventory' : '库存管理' }}</RouterLink>
      </Button>
    </div>
  </Card>
</template>
