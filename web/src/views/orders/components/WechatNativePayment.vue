<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toDataURL } from 'qrcode'
import { Button } from '@lingdian/console-ui/button'
import type { MerchantWechatNativePayment } from '@lingdian/contracts'
import DataActionButton from '@/components/DataActionButton.vue'
import { createMerchantWechatNativePayment, getMerchantWechatNativePayment } from '@/services/orders'
import { useOrderLocale } from '../use-order-locale'

const props = defineProps<{ orderId: string; disabled: boolean }>()
const emit = defineEmits<{ started: []; updated: [] }>()
const { t, money, date } = useOrderLocale()

const payment = ref<MerchantWechatNativePayment>()
const image = ref('')
const clock = ref(Date.now())
const creating = ref(false)
const failed = ref(false)
let disposed = false
let inFlight = false
let poll: ReturnType<typeof setTimeout> | undefined
let ticker: ReturnType<typeof setInterval> | undefined

const hasExpired = computed(() => Boolean(payment.value?.expires_at && Date.parse(payment.value.expires_at) <= clock.value))
const canGenerate = computed(() => payment.value?.state === 'AVAILABLE' || payment.value?.state === 'EXPIRED')
const visibleCode = computed(() => payment.value?.state === 'WAITING' && !hasExpired.value && image.value)

async function refresh(create = false) {
  if (inFlight || disposed) return
  clearTimeout(poll)
  inFlight = true
  creating.value = create
  try {
    const result = await (create ? createMerchantWechatNativePayment : getMerchantWechatNativePayment)(props.orderId)
    if (disposed) return
    failed.value = false
    if (result.state === 'ORDER_UPDATED') emit('updated')
    if (result.state === 'WAITING' || result.state === 'EXPIRED') emit('started')
    if (result.code_url !== payment.value?.code_url || (!image.value && result.code_url)) {
      const png = result.code_url ? await toDataURL(result.code_url, { width: 320, margin: 4 }) : ''
      if (disposed) return
      image.value = png
    }
    payment.value = result
  } catch {
    if (!disposed) failed.value = true
    // A creation request can time out after reserving an order. Check for the active attempt.
    if (create && !disposed) poll = setTimeout(() => void refresh(), 1500)
  } finally {
    inFlight = false
    creating.value = false
    clock.value = Date.now()
    if (!disposed && payment.value?.state === 'WAITING') {
      clearTimeout(poll)
      poll = setTimeout(() => void refresh(), 2500)
    }
  }
}

onMounted(() => {
  void refresh()
  ticker = setInterval(() => { clock.value = Date.now() }, 1000)
})
onUnmounted(() => {
  disposed = true
  clearInterval(ticker)
  clearTimeout(poll)
})
</script>

<template>
  <section v-if="payment?.state !== 'ORDER_UPDATED'" class="grid gap-3 border-y py-4" :aria-label="t('wechatScanTitle')">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">{{ t('wechatScanTitle') }}</h3>
      <Button v-if="canGenerate" :disabled="disabled || creating" @click="refresh(true)">
        {{ t(creating ? 'wechatScanCreating' : payment?.state === 'EXPIRED' ? 'wechatScanRenew' : 'wechatScanGenerate') }}
      </Button>
    </div>
    <div v-if="visibleCode && payment" class="grid justify-items-center gap-1.5 text-center">
      <strong class="text-2xl tabular-nums">{{ money(payment.amount_minor / 100) }}</strong>
      <img :src="image" :alt="t('wechatScanTitle')" width="240" height="240" class="h-auto w-60 max-w-full bg-white">
      <p role="status" class="text-sm font-medium">{{ t('wechatScanPrompt') }}</p>
      <p class="text-xs text-muted-foreground">{{ t('wechatScanExpires') }} {{ date(payment.expires_at) }}</p>
    </div>
    <p v-else-if="payment?.state === 'EXPIRED' || hasExpired" role="status" class="text-sm text-muted-foreground">{{ t('wechatScanExpired') }}</p>
    <p v-else-if="payment?.state === 'WAITING'" role="status" class="text-sm text-muted-foreground">{{ t('wechatScanWaiting') }}</p>
    <p v-else-if="payment?.state === 'BLOCKED'" role="status" class="text-sm text-muted-foreground">{{ t('wechatScanBlocked') }}</p>
    <p v-else-if="payment?.state === 'UNAVAILABLE'" class="text-sm text-muted-foreground">{{ t('wechatScanUnavailable') }}</p>
    <p v-else-if="!payment && !failed" role="status" class="text-sm text-muted-foreground">{{ t('loading') }}</p>
    <div v-if="failed" class="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
      <p>{{ t('wechatScanError') }}</p>
      <DataActionButton action="refresh" :label="t('refresh')" :disabled="creating" @click="refresh()" />
    </div>
  </section>
</template>
