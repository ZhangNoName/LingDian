<template>
  <Card class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border-border/80">
    <CardHeader class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
      <div>
        <CardTitle class="text-xl">订单结算</CardTitle>
        <CardDescription class="mt-1 leading-6">
          右侧先核对会员与优惠，点击确定后再选择桌台和支付方式。
        </CardDescription>
      </div>
    </CardHeader>
    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <Card class="rounded-lg border-border/80">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">会员信息</CardTitle>
            <CardDescription>输入会员号自动识别折扣，也可以一键填充示例会员。</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="flex gap-2">
              <Input
                :model-value="memberPhone"
                maxlength="11"
                placeholder="输入会员手机号"
                class="rounded-md"
                @update:model-value="$emit('update:memberPhone', String($event))"
              />
              <Button variant="outline" class="rounded-md" @click="$emit('fillDemoMember')">示例会员</Button>
            </div>
            <div class="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ memberProfile ? memberProfile.name : '普通顾客' }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ memberProfile ? `${memberProfile.level} · 会员号 ${memberPhone}` : '未匹配到会员，当前按原价结算。' }}
                </p>
              </div>
              <Badge :variant="memberProfile ? 'secondary' : 'outline'">
                {{ memberProfile ? `${Math.round(discountRate * 100)} 折` : '无折扣' }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-lg border-border/80">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">优惠券</CardTitle>
            <CardDescription>在结算前选择可用优惠券，系统会自动计算优惠金额。</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4">
            <Select :model-value="selectedCouponCode" @update:model-value="$emit('update:selectedCouponCode', String($event))">
              <SelectTrigger class="w-full rounded-md">
                <SelectValue placeholder="选择优惠券" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不使用优惠券</SelectItem>
                <SelectItem v-for="coupon in availableCoupons" :key="coupon.code" :value="coupon.code">
                  {{ coupon.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <div class="grid gap-2 rounded-md bg-muted/40 p-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">已选优惠</span>
                <span>{{ selectedCoupon.label }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">优惠金额</span>
                <span class="text-emerald-600">- ¥ {{ couponDiscountAmount.toFixed(2) }}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-lg border-border/80">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">餐品清单</CardTitle>
          </CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>餐品</TableHead>
                  <TableHead class="w-28">数量</TableHead>
                  <TableHead class="w-28">小计</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="cartItems.length === 0">
                  <TableCell colspan="3" class="py-10 text-center text-sm text-muted-foreground">
                    还没有选择餐品
                  </TableCell>
                </TableRow>
                <TableRow v-for="item in cartItems" :key="item.id">
                  <TableCell>
                    <div>
                      <p class="font-medium text-foreground">{{ item.name }}</p>
                      <p class="mt-1 text-xs text-muted-foreground">{{ item.category }}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <Button variant="outline" size="icon" class="size-8 rounded-md" @click="$emit('decreaseItem', item.id)">
                        -
                      </Button>
                      <span class="min-w-5 text-center text-sm">{{ item.quantity }}</span>
                      <Button variant="outline" size="icon" class="size-8 rounded-md" @click="$emit('increaseItem', item.id)">
                        +
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell class="font-medium">¥ {{ (item.price * item.quantity).toFixed(2) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card class="rounded-lg border-border/80">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">备注</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              :model-value="remark"
              class="min-h-24 rounded-md"
              placeholder="可填写少冰、少辣、打包需求或顾客特殊说明"
              @update:model-value="$emit('update:remark', String($event))"
            />
          </CardContent>
        </Card>
      </div>

      <div class="shrink-0 border-t border-border/70 bg-background pt-4">
        <Card class="rounded-lg border-border/80">
          <CardContent class="grid gap-3 p-5">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">商品金额</span>
              <span>¥ {{ subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">会员优惠</span>
              <span class="text-emerald-600">- ¥ {{ memberDiscountAmount.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">优惠券</span>
              <span class="text-emerald-600">- ¥ {{ couponDiscountAmount.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">待选桌台</span>
              <span>{{ tableLabel }}</span>
            </div>
            <Separator />
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="text-sm text-muted-foreground">应收金额</p>
                <p class="mt-1 text-3xl font-semibold text-foreground">¥ {{ payableAmount.toFixed(2) }}</p>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" class="rounded-md" @click="$emit('resetOrder')">清空</Button>
                <Button :disabled="cartItems.length === 0" class="rounded-md px-6" @click="$emit('openCheckout')">
                  确定
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Button } from '@/baseComponents/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
import { Input } from '@/baseComponents/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/baseComponents/select'
import { Separator } from '@/baseComponents/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/baseComponents/table'
import { Textarea } from '@/baseComponents/textarea'
import type { CartItem, Coupon, MemberProfile } from '../types'

defineProps<{
  availableCoupons: Coupon[]
  cartItems: CartItem[]
  couponDiscountAmount: number
  discountRate: number
  memberDiscountAmount: number
  memberPhone: string
  memberProfile: MemberProfile | null
  payableAmount: number
  remark: string
  selectedCoupon: Coupon
  selectedCouponCode: string
  subtotal: number
  tableLabel: string
}>()

defineEmits<{
  (event: 'decreaseItem', id: string): void
  (event: 'fillDemoMember'): void
  (event: 'increaseItem', id: string): void
  (event: 'openCheckout'): void
  (event: 'resetOrder'): void
  (event: 'update:memberPhone', value: string): void
  (event: 'update:remark', value: string): void
  (event: 'update:selectedCouponCode', value: string): void
}>()
</script>
