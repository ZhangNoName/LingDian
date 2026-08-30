<template>
  <div class="grid gap-5">
    <Card class="rounded-lg border-border/80">
      <CardHeader class="gap-3 border-b md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle class="text-xl">门店设置</CardTitle>
          <CardDescription class="mt-1 leading-6">
            当前采用单店运营模式。菜单、订单和支付均由服务端绑定到这一家主门店。
          </CardDescription>
        </div>
        <Button variant="outline" :disabled="loading" @click="loadStore">
          {{ loading ? '加载中…' : '刷新门店信息' }}
        </Button>
      </CardHeader>

      <CardContent>
        <div v-if="loading" class="py-12 text-center text-sm text-muted-foreground" aria-live="polite">
          正在加载门店信息…
        </div>

        <div
          v-else-if="errorMessage"
          class="grid justify-items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          <p>{{ errorMessage }}</p>
          <Button variant="outline" size="sm" @click="loadStore">重新加载</Button>
        </div>

        <section v-else-if="storeState.kind === 'ready'" class="grid gap-5">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">当前门店</p>
              <h2 class="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {{ storeState.store.name }}
              </h2>
            </div>
            <Badge variant="outline" :class="statusPresentation.className">
              <span class="size-2 rounded-full bg-current" aria-hidden="true"></span>
              {{ statusPresentation.label }}
            </Badge>
          </div>

          <dl class="grid overflow-hidden rounded-lg border border-border sm:grid-cols-2">
            <div class="border-b border-border p-4 sm:border-r">
              <dt class="text-xs font-medium text-muted-foreground">门店编号</dt>
              <dd class="mt-2 break-all font-mono text-sm text-foreground">{{ storeState.store.code }}</dd>
            </div>
            <div class="border-b border-border p-4">
              <dt class="text-xs font-medium text-muted-foreground">运营模式</dt>
              <dd class="mt-2 text-sm font-medium text-foreground">单店运营</dd>
            </div>
            <div class="p-4 sm:col-span-2">
              <dt class="text-xs font-medium text-muted-foreground">门店 ID</dt>
              <dd class="mt-2 break-all font-mono text-sm text-foreground">{{ storeState.store.id }}</dd>
            </div>
          </dl>

          <p class="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
            单店模式不提供新建或切换门店操作。门店范围仍保留标准门店 ID，未来启用多店模式时可继续沿用现有数据和接口。
          </p>
        </section>

        <div v-else-if="storeState.kind === 'empty'" class="py-12 text-center">
          <p class="font-medium text-foreground">尚未配置主门店</p>
          <p class="mt-2 text-sm text-muted-foreground">请联系平台管理员完成门店初始化和商家账号授权。</p>
        </div>

        <div v-else class="rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <p class="font-medium">检测到 {{ storeState.storeCount }} 家可管理门店，无法确定唯一主门店。</p>
          <p class="mt-2 leading-6">单店模式不会自动选择其中一家，请联系平台管理员检查主门店配置和账号授权。</p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Badge } from '@/baseComponents/badge'
import { Button } from '@/baseComponents/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
import { listMerchantStores, type MerchantStoreSummary } from '@/services/integrations'
import { getStoreStatusPresentation, resolveSingleStoreView } from './store-view'

const stores = ref<MerchantStoreSummary[]>([])
const loading = ref(false)
const errorMessage = ref('')
const storeState = computed(() => resolveSingleStoreView(stores.value))
const statusPresentation = computed(() => {
  return storeState.value.kind === 'ready'
    ? getStoreStatusPresentation(storeState.value.store.status)
    : getStoreStatusPresentation('CLOSED')
})
let loadSequence = 0

async function loadStore() {
  const sequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listMerchantStores()
    if (sequence === loadSequence) stores.value = result
  } catch (error) {
    if (sequence === loadSequence) {
      errorMessage.value = error instanceof Error ? error.message : '门店信息加载失败，请稍后重试。'
    }
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

onMounted(loadStore)
</script>
