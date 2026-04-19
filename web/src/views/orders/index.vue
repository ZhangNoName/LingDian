<template>
  <div class="grid gap-5 xl:grid-cols-[1.5fr_0.95fr] xl:items-start">
    <PageSection
      title="点餐收银"
      description="前台快速录单，支持堂食、外带、自提三种下单方式。"
      card-class="xl:h-[calc(100vh-7.5rem)]"
      content-class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <Input v-model="keyword" class="w-64 rounded-full" placeholder="搜索餐品名称 / 分类 / SKU" />
          <Button
            v-for="mode in orderModes"
            :key="mode.value"
            :variant="orderForm.orderType === mode.value ? 'default' : 'outline'"
            class="rounded-full"
            @click="orderForm.orderType = mode.value"
          >
            {{ mode.label }}
          </Button>
        </div>
      </template>

      <div class="grid gap-4 rounded-3xl border border-border bg-card p-4 md:grid-cols-4">
        <div>
          <p class="text-xs text-muted-foreground">桌号 / 取餐号</p>
          <Input
            v-model="orderForm.tableNo"
            class="mt-2 rounded-2xl"
            :placeholder="orderForm.orderType === 'dine_in' ? '如 A08' : '如 T12'"
          />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">人数</p>
          <Input v-model="orderForm.guestCount" type="number" min="1" class="mt-2 rounded-2xl" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">收银员</p>
          <Input v-model="orderForm.cashier" class="mt-2 rounded-2xl" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">来源门店</p>
          <Input v-model="orderForm.storeName" class="mt-2 rounded-2xl" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button
          v-for="category in categories"
          :key="category"
          :variant="activeCategory === category ? 'default' : 'outline'"
          class="rounded-full"
          @click="activeCategory = category"
        >
          {{ category }}
        </Button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <Card
            v-for="product in filteredProducts"
            :key="product.id"
            class="rounded-3xl border-border/80 shadow-sm transition hover:border-primary/40"
          >
            <CardHeader class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <CardTitle class="text-base">{{ product.name }}</CardTitle>
                  <CardDescription class="mt-1 leading-6">{{ product.description }}</CardDescription>
                </div>
                <Badge :variant="product.badgeVariant">{{ product.tag }}</Badge>
              </div>
              <div class="flex flex-wrap gap-2">
                <Badge variant="outline">{{ product.category }}</Badge>
                <Badge variant="outline">库存 {{ product.stock }}</Badge>
              </div>
            </CardHeader>
            <CardContent class="flex items-end justify-between gap-3">
              <div>
                <p class="text-xs text-muted-foreground">单价</p>
                <p class="mt-1 text-2xl font-semibold text-foreground">¥ {{ product.price.toFixed(2) }}</p>
              </div>
              <Button class="rounded-full" @click="addToCart(product)">加入</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageSection>

    <PageSection
      title="订单结算"
      description="自动计算会员、优惠券和手动折扣后的应收金额。"
      card-class="xl:h-[calc(100vh-7.5rem)]"
      content-class="min-h-0 overflow-y-auto pr-1"
    >
      <div class="grid gap-4">
        <Card class="rounded-3xl border-border/80 shadow-none">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">会员信息</CardTitle>
            <CardDescription>输入手机号识别会员等级和折扣。</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="flex gap-2">
              <Input
                v-model="memberPhone"
                maxlength="11"
                placeholder="输入会员手机号"
                class="rounded-full"
              />
              <Button variant="outline" class="rounded-full" @click="fillDemoMember">
                示例会员
              </Button>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ memberProfile ? memberProfile.name : '普通顾客' }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ memberProfile ? `${memberProfile.level} · 手机号 ${memberPhone}` : '未匹配会员，按原价结算' }}
                </p>
              </div>
              <Badge :variant="memberProfile ? 'secondary' : 'outline'">
                {{ memberProfile ? `${Math.round(discountRate * 100)} 折` : '无折扣' }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/80 shadow-none">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">优惠与支付</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="grid gap-2">
              <p class="text-xs text-muted-foreground">优惠券</p>
              <Select v-model="selectedCouponCode">
                <SelectTrigger class="w-full rounded-2xl">
                  <SelectValue placeholder="选择优惠券" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不使用优惠券</SelectItem>
                  <SelectItem v-for="coupon in availableCoupons" :key="coupon.code" :value="coupon.code">
                    {{ coupon.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="grid gap-2">
              <p class="text-xs text-muted-foreground">手动折扣</p>
              <div class="grid grid-cols-4 gap-2">
                <Button
                  v-for="rate in manualDiscountOptions"
                  :key="rate"
                  :variant="manualDiscountRate === rate ? 'default' : 'outline'"
                  class="rounded-2xl"
                  @click="manualDiscountRate = rate"
                >
                  {{ Math.round(rate * 100) }}%
                </Button>
              </div>
            </div>

            <div class="grid gap-2">
              <p class="text-xs text-muted-foreground">支付方式</p>
              <div class="grid grid-cols-3 gap-2">
                <Button
                  v-for="method in paymentMethods"
                  :key="method.value"
                  :variant="paymentMethod === method.value ? 'default' : 'outline'"
                  class="rounded-2xl justify-start"
                  @click="paymentMethod = method.value"
                >
                  {{ method.label }}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/80 shadow-none">
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
                      <Button variant="outline" size="icon" class="size-8 rounded-full" @click="decreaseItem(item.id)">
                        -
                      </Button>
                      <span class="min-w-5 text-center text-sm">{{ item.quantity }}</span>
                      <Button variant="outline" size="icon" class="size-8 rounded-full" @click="increaseItem(item.id)">
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

        <Card class="rounded-3xl border-border/80 shadow-none">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">备注</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              v-model="orderForm.remark"
              class="min-h-24 rounded-2xl"
              placeholder="可填写少冰、少辣、打包需求、顾客特殊说明等"
            />
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/80 shadow-sm">
          <CardContent class="grid gap-3 p-5">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">商品金额</span>
              <span>¥ {{ subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">会员折扣</span>
              <span class="text-emerald-600">- ¥ {{ memberDiscountAmount.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">优惠券</span>
              <span class="text-emerald-600">- ¥ {{ couponDiscountAmount.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">手动折扣</span>
              <span class="text-emerald-600">- ¥ {{ manualDiscountAmount.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">支付方式</span>
              <span>{{ selectedPaymentLabel }}</span>
            </div>
            <Separator />
            <div class="flex items-end justify-between">
              <div>
                <p class="text-sm text-muted-foreground">应收金额</p>
                <p class="mt-1 text-3xl font-semibold text-foreground">¥ {{ payableAmount.toFixed(2) }}</p>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" class="rounded-full" @click="resetOrder">清空</Button>
                <Button :disabled="cartItems.length === 0" class="rounded-full px-6">
                  确认收款
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageSection from '@/components/shared/page-section/index.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type PaymentMethod = 'cash' | 'alipay' | 'wechat'
type OrderType = 'dine_in' | 'takeout' | 'pickup'

type Product = {
  id: string
  name: string
  description: string
  category: string
  price: number
  stock: number
  tag: string
  badgeVariant: 'secondary' | 'outline' | 'destructive'
}

type CartItem = Product & {
  quantity: number
}

const keyword = ref('')
const activeCategory = ref('全部')
const memberPhone = ref('')
const paymentMethod = ref<PaymentMethod>('cash')
const selectedCouponCode = ref('none')
const manualDiscountRate = ref(1)

const orderModes: Array<{ label: string; value: OrderType }> = [
  { label: '堂食', value: 'dine_in' },
  { label: '外带', value: 'takeout' },
  { label: '自提', value: 'pickup' },
]

const orderForm = reactive({
  orderType: 'dine_in' as OrderType,
  tableNo: 'A08',
  guestCount: 2,
  cashier: '前台 01',
  storeName: '陆家嘴示范店',
  remark: '',
})

const paymentMethods: Array<{ label: string; value: PaymentMethod }> = [
  { label: '现金', value: 'cash' },
  { label: '支付宝', value: 'alipay' },
  { label: '微信', value: 'wechat' },
]

const categories = ['全部', '主食', '套餐', '小吃', '饮品']
const manualDiscountOptions = [1, 0.95, 0.9, 0.88]

const products: Product[] = [
  {
    id: 'p1',
    name: '炙烤鸡腿饭',
    description: '招牌主食，含时蔬和溏心蛋',
    category: '主食',
    price: 29.9,
    stock: 128,
    tag: '热销',
    badgeVariant: 'secondary',
  },
  {
    id: 'p2',
    name: '黑椒牛肉意面',
    description: '经典西式主食，适合晚市',
    category: '主食',
    price: 32,
    stock: 64,
    tag: '新品',
    badgeVariant: 'outline',
  },
  {
    id: 'p3',
    name: '双人分享套餐',
    description: '鸡腿饭 + 小吃 + 饮品组合',
    category: '套餐',
    price: 58.8,
    stock: 36,
    tag: '套餐',
    badgeVariant: 'secondary',
  },
  {
    id: 'p4',
    name: '现炸薯条',
    description: '适合加购，支持单点',
    category: '小吃',
    price: 12,
    stock: 86,
    tag: '加购',
    badgeVariant: 'outline',
  },
  {
    id: 'p5',
    name: '冰美式',
    description: '门店现制饮品',
    category: '饮品',
    price: 16,
    stock: 72,
    tag: '饮品',
    badgeVariant: 'outline',
  },
  {
    id: 'p6',
    name: '芝士鸡块',
    description: '小食推荐，适合搭配套餐',
    category: '小吃',
    price: 18,
    stock: 55,
    tag: '推荐',
    badgeVariant: 'secondary',
  },
]

const cartItems = ref<CartItem[]>([
  {
    ...products[0],
    quantity: 1,
  },
  {
    ...products[3],
    quantity: 2,
  },
])

const memberProfiles: Record<string, { name: string; level: string; discountRate: number }> = {
  '13800138000': { name: '张女士', level: '银卡会员', discountRate: 0.95 },
  '13900139000': { name: '李先生', level: '金卡会员', discountRate: 0.9 },
  '13600136000': { name: '王女士', level: '黑金会员', discountRate: 0.85 },
}

const coupons = [
  { code: 'none', label: '不使用优惠券', discountAmount: 0 },
  { code: 'NEW8', label: '新人券 ¥8', discountAmount: 8 },
  { code: 'MEAL12', label: '套餐券 ¥12', discountAmount: 12 },
  { code: 'VIP15', label: '会员券 ¥15', discountAmount: 15 },
]

const availableCoupons = coupons.filter((coupon) => coupon.code !== 'none')

const filteredProducts = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  return products.filter((product) => {
    const matchesCategory = activeCategory.value === '全部' || product.category === activeCategory.value
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      product.name.toLowerCase().includes(normalizedKeyword) ||
      product.category.toLowerCase().includes(normalizedKeyword)
    return matchesCategory && matchesKeyword
  })
})

const memberProfile = computed(() => memberProfiles[memberPhone.value] ?? null)
const discountRate = computed(() => memberProfile.value?.discountRate ?? 1)
const subtotal = computed(() => cartItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0))
const memberDiscountAmount = computed(() => subtotal.value * (1 - discountRate.value))
const afterMemberDiscount = computed(() => subtotal.value - memberDiscountAmount.value)
const selectedCoupon = computed(() => coupons.find((coupon) => coupon.code === selectedCouponCode.value) ?? coupons[0])
const couponDiscountAmount = computed(() => Math.min(selectedCoupon.value.discountAmount, afterMemberDiscount.value))
const afterCouponDiscount = computed(() => afterMemberDiscount.value - couponDiscountAmount.value)
const manualDiscountAmount = computed(() => afterCouponDiscount.value * (1 - manualDiscountRate.value))
const payableAmount = computed(() => afterCouponDiscount.value - manualDiscountAmount.value)
const selectedPaymentLabel = computed(
  () => paymentMethods.find((method) => method.value === paymentMethod.value)?.label ?? '现金',
)

function addToCart(product: Product) {
  const existing = cartItems.value.find((item) => item.id === product.id)
  if (existing) {
    existing.quantity += 1
    return
  }
  cartItems.value.push({
    ...product,
    quantity: 1,
  })
}

function increaseItem(id: string) {
  const target = cartItems.value.find((item) => item.id === id)
  if (target) {
    target.quantity += 1
  }
}

function decreaseItem(id: string) {
  const target = cartItems.value.find((item) => item.id === id)
  if (!target) {
    return
  }
  if (target.quantity === 1) {
    cartItems.value = cartItems.value.filter((item) => item.id !== id)
    return
  }
  target.quantity -= 1
}

function fillDemoMember() {
  memberPhone.value = '13900139000'
}

function resetOrder() {
  cartItems.value = []
  memberPhone.value = ''
  selectedCouponCode.value = 'none'
  manualDiscountRate.value = 1
  paymentMethod.value = 'cash'
  orderForm.remark = ''
}
</script>
