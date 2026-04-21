<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="p-0">
      <div class="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div class="grid gap-6 p-6">
          <DialogHeader>
            <DialogTitle>确认订单</DialogTitle>
            <DialogDescription>
              选择桌台和支付方式后即可完成本次收银，当前订单共 {{ totalQuantity }} 件商品。
            </DialogDescription>
          </DialogHeader>

          <div v-if="orderForm.orderType === 'dine_in'" class="grid gap-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-foreground">选择桌台</p>
                <p class="text-xs text-muted-foreground">
                  可用 {{ availableTables.length }} 张，已占用 {{ occupiedTables.length }} 张
                </p>
              </div>
              <Badge variant="outline">{{ selectedTableLabel }}</Badge>
            </div>

            <div class="grid max-h-[340px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <button
                v-for="table in diningTables"
                :key="table.id"
                type="button"
                :disabled="table.occupied"
                class="rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
                :class="
                  table.id === selectedTableId
                    ? 'border-primary bg-primary/5'
                    : 'border-border/80 bg-card hover:border-primary/35'
                "
                @click="$emit('selectTable', table.id)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-base font-semibold text-foreground">{{ table.label }}</p>
                    <p class="mt-1 text-xs text-muted-foreground">{{ table.area }}</p>
                  </div>
                  <Badge :variant="table.occupied ? 'destructive' : 'secondary'">
                    {{ table.occupied ? '已有人' : '空闲中' }}
                  </Badge>
                </div>
                <div class="mt-4 flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">座位数</span>
                  <span>{{ table.seats }} 位</span>
                </div>
              </button>
            </div>
          </div>

          <div v-else class="rounded-lg border border-dashed border-border/80 bg-muted/30 p-5">
            <p class="text-sm font-medium text-foreground">{{ selectedOrderModeLabel }}</p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              当前订单无需选择桌台，确认后将按 {{ selectedOrderModeLabel }} 流程出单。
            </p>
          </div>

          <div class="grid gap-3">
            <div>
              <p class="text-sm font-medium text-foreground">支付方式</p>
              <p class="mt-1 text-xs text-muted-foreground">请在收银前选择本次付款渠道。</p>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <Button
                v-for="method in paymentMethods"
                :key="method.value"
                :variant="paymentMethod === method.value ? 'default' : 'outline'"
                class="h-12 rounded-md"
                @click="$emit('update:paymentMethod', method.value)"
              >
                {{ method.label }}
              </Button>
            </div>
          </div>
        </div>

        <div class="grid gap-5 rounded-b-lg bg-slate-50 p-6 md:rounded-r-lg md:rounded-bl-none dark:bg-slate-950/30">
          <div class="rounded-lg border border-border/80 bg-background p-4">
            <p class="text-sm font-medium text-foreground">订单摘要</p>
            <div class="mt-4 grid gap-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">下单方式</span>
                <span>{{ selectedOrderModeLabel }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">桌台</span>
                <span>{{ orderForm.orderType === 'dine_in' ? selectedTableLabel : '无需桌台' }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">支付方式</span>
                <span>{{ selectedPaymentLabel }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">顾客人数</span>
                <span>{{ orderForm.guestCount }} 位</span>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-border/80 bg-background p-4">
            <p class="text-sm font-medium text-foreground">金额明细</p>
            <div class="mt-4 grid gap-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">商品金额</span>
                <span>¥ {{ subtotal.toFixed(2) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">会员优惠</span>
                <span class="text-emerald-600">- ¥ {{ memberDiscountAmount.toFixed(2) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">优惠券</span>
                <span class="text-emerald-600">- ¥ {{ couponDiscountAmount.toFixed(2) }}</span>
              </div>
              <Separator />
              <div class="flex items-end justify-between">
                <span class="text-sm text-muted-foreground">应收金额</span>
                <span class="text-3xl font-semibold text-foreground">¥ {{ payableAmount.toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" class="rounded-md" @click="$emit('update:open', false)">返回修改</Button>
            <Button class="rounded-md px-6" :disabled="checkoutDisabled" @click="$emit('confirmOrder')">
              确认收款
            </Button>
          </DialogFooter>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Button } from '@/baseComponents/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/baseComponents/dialog'
import { Separator } from '@/baseComponents/separator'
import type { DiningTable, OrderForm, PaymentMethod, PaymentOption } from '../types'

defineProps<{
  availableTables: DiningTable[]
  checkoutDisabled: boolean
  couponDiscountAmount: number
  diningTables: DiningTable[]
  memberDiscountAmount: number
  occupiedTables: DiningTable[]
  open: boolean
  orderForm: OrderForm
  payableAmount: number
  paymentMethod: PaymentMethod
  paymentMethods: PaymentOption[]
  selectedOrderModeLabel: string
  selectedPaymentLabel: string
  selectedTableId: string
  selectedTableLabel: string
  subtotal: number
  totalQuantity: number
}>()

defineEmits<{
  (event: 'confirmOrder'): void
  (event: 'selectTable', id: string): void
  (event: 'update:open', value: boolean): void
  (event: 'update:paymentMethod', value: PaymentMethod): void
}>()
</script>
