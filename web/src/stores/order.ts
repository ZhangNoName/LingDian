import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { coupons, diningTables, memberProfiles, orderModes, paymentMethods } from '@/views/orders/mock'
import type {
  BadgeVariant,
  CartItem,
  OrderForm,
  PaymentMethod,
  Product,
  ProductApiItem,
} from '@/views/orders/types'

type OrderState = {
  keyword: string
  activeCategory: string
  memberPhone: string
  paymentMethod: PaymentMethod
  selectedCouponCode: string
  checkoutDialogOpen: boolean
  selectedTableId: string
  orderForm: OrderForm
  cartItems: CartItem[]
}

const products = ref<Product[]>([])
const loadingProducts = ref(false)
const submittingOrder = ref(false)
const initialized = ref(false)

const state = reactive<OrderState>({
  keyword: '',
  activeCategory: '全部',
  memberPhone: '',
  paymentMethod: 'cash',
  selectedCouponCode: 'none',
  checkoutDialogOpen: false,
  selectedTableId: 't-a01',
  orderForm: {
    orderType: 'dine_in',
    guestCount: 2,
    cashier: '前台 01',
    storeName: 'SwiftBite Demo Store',
    remark: '',
  },
  cartItems: [],
})

const availableCoupons = coupons.filter((coupon) => coupon.code !== 'none')

const categories = computed(() => [
  '全部',
  ...new Set(products.value.map((product) => product.category).filter(Boolean)),
])

const filteredProducts = computed(() => {
  const normalizedKeyword = state.keyword.trim().toLowerCase()

  return products.value.filter((product) => {
    const matchesCategory =
      state.activeCategory === '全部' ||
      product.category === state.activeCategory
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      product.name.toLowerCase().includes(normalizedKeyword) ||
      product.category.toLowerCase().includes(normalizedKeyword) ||
      product.description.toLowerCase().includes(normalizedKeyword)

    return matchesCategory && matchesKeyword
  })
})

const cartProductIds = computed(() => new Set(state.cartItems.map((item) => item.id)))
const memberProfile = computed(() => memberProfiles[state.memberPhone] ?? null)
const discountRate = computed(() => memberProfile.value?.discountRate ?? 1)
const subtotal = computed(() =>
  state.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
)
const totalQuantity = computed(() =>
  state.cartItems.reduce((sum, item) => sum + item.quantity, 0),
)
const memberDiscountAmount = computed(
  () => subtotal.value * (1 - discountRate.value),
)
const afterMemberDiscount = computed(
  () => subtotal.value - memberDiscountAmount.value,
)
const selectedCoupon = computed(
  () =>
    coupons.find((coupon) => coupon.code === state.selectedCouponCode) ??
    coupons[0],
)
const couponDiscountAmount = computed(() =>
  Math.min(selectedCoupon.value.discountAmount, afterMemberDiscount.value),
)
const payableAmount = computed(
  () => afterMemberDiscount.value - couponDiscountAmount.value,
)
const selectedPaymentLabel = computed(
  () =>
    paymentMethods.find((method) => method.value === state.paymentMethod)
      ?.label ?? '现金',
)
const selectedOrderModeLabel = computed(
  () =>
    orderModes.find((mode) => mode.value === state.orderForm.orderType)
      ?.label ?? '堂食',
)
const selectedTable = computed(
  () =>
    diningTables.find((table) => table.id === state.selectedTableId) ?? null,
)
const selectedTableLabel = computed(
  () => selectedTable.value?.label ?? '请选择桌台',
)
const availableTables = computed(() =>
  diningTables.filter((table) => !table.occupied),
)
const occupiedTables = computed(() =>
  diningTables.filter((table) => table.occupied),
)
const checkoutDisabled = computed(
  () =>
    submittingOrder.value ||
    state.cartItems.length === 0 ||
    (state.orderForm.orderType === 'dine_in' && !selectedTable.value),
)

function mapApiProducts(items: ProductApiItem[]) {
  return items
    .filter((item) => item.is_active)
    .flatMap((item) =>
      item.skus.map((sku, index) => ({
        id: sku.id,
        skuId: sku.id,
        storeId: item.store_id,
        productId: item.id,
        name: `${item.name}${item.skus.length > 1 ? ` ${sku.sku_name}` : ''}`,
        description: item.description ?? '',
        category: item.category,
        price: sku.price,
        stock: sku.stock_count,
        tag: index === 0 ? '热销' : '规格',
        badgeVariant: (index === 0 ? 'secondary' : 'outline') as BadgeVariant,
      })),
    )
}

async function fetchProducts() {
  loadingProducts.value = true

  try {
    const response = await fetch('/api/products')

    if (!response.ok) {
      throw new Error('商品加载失败')
    }

    const data: ProductApiItem[] = await response.json()
    products.value = mapApiProducts(data)
    state.orderForm.storeName = data[0]?.name ? 'SwiftBite Demo Store' : state.orderForm.storeName

    const nextCartItems = state.cartItems
      .map((item) => {
        const latest = products.value.find((product) => product.id === item.id)
        if (!latest) {
          return null
        }

        return {
          ...latest,
          quantity: Math.min(item.quantity, latest.stock),
        }
      })
      .filter((item): item is CartItem => item !== null && item.quantity > 0)

    state.cartItems = nextCartItems

    if (!categories.value.includes(state.activeCategory)) {
      state.activeCategory = '全部'
    }

    initialized.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '商品加载失败')
  } finally {
    loadingProducts.value = false
  }
}

async function initialize() {
  if (initialized.value) {
    return
  }

  await fetchProducts()
}

function addToCart(product: Product) {
  const existing = state.cartItems.find((item) => item.id === product.id)
  if (existing) {
    if (existing.quantity >= product.stock) {
      return
    }

    existing.quantity += 1
    return
  }

  if (product.stock <= 0) {
    return
  }

  state.cartItems.push({
    ...product,
    quantity: 1,
  })
}

function increaseItem(id: string) {
  const target = state.cartItems.find((item) => item.id === id)
  if (!target || target.quantity >= target.stock) {
    return
  }

  target.quantity += 1
}

function decreaseItem(id: string) {
  const index = state.cartItems.findIndex((item) => item.id === id)
  if (index < 0) {
    return
  }

  const target = state.cartItems[index]
  if (target.quantity === 1) {
    state.cartItems.splice(index, 1)
    return
  }

  target.quantity -= 1
}

function fillDemoMember() {
  state.memberPhone = '13900139000'
}

function selectTable(tableId: string) {
  const table = diningTables.find((item) => item.id === tableId)
  if (!table || table.occupied) {
    return
  }

  state.selectedTableId = tableId
}

function openCheckoutDialog() {
  if (state.cartItems.length === 0) {
    return
  }

  if (state.orderForm.orderType === 'dine_in' && selectedTable.value?.occupied) {
    state.selectedTableId = availableTables.value[0]?.id ?? ''
  }

  state.checkoutDialogOpen = true
}

function getSubmitMobile() {
  return /^1\d{10}$/.test(state.memberPhone) ? state.memberPhone : '13800000000'
}

function getStoreId() {
  return state.cartItems[0]?.storeId ?? products.value[0]?.storeId ?? ''
}

async function confirmOrder() {
  if (checkoutDisabled.value) {
    return
  }

  const storeId = getStoreId()
  if (!storeId) {
    ElMessage.error('缺少门店信息，无法提交订单')
    return
  }

  submittingOrder.value = true

  try {
    const response = await fetch('/api/order/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId,
        orderType: state.orderForm.orderType,
        customerName: memberProfile.value?.name ?? '现场顾客',
        mobile: getSubmitMobile(),
        couponCode: state.selectedCouponCode === 'none' ? undefined : state.selectedCouponCode,
        items: state.cartItems.map((item) => ({
          sku_id: item.skuId,
          quantity: item.quantity,
          remark: state.orderForm.remark || undefined,
        })),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      const message = Array.isArray(errorBody?.message)
        ? errorBody.message.join('，')
        : errorBody?.message
      throw new Error(message ?? '下单失败')
    }

    const result = await response.json()
    state.checkoutDialogOpen = false
    ElMessage.success(`下单成功，订单号 ${result.orderNo}`)
    resetOrder()
    await fetchProducts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '下单失败')
    await fetchProducts()
  } finally {
    submittingOrder.value = false
  }
}

function resetOrder() {
  state.cartItems = []
  state.memberPhone = ''
  state.selectedCouponCode = 'none'
  state.paymentMethod = 'cash'
  state.checkoutDialogOpen = false
  state.selectedTableId = availableTables.value[0]?.id ?? ''
  state.orderForm.remark = ''
}

function isProductInCart(productId: string) {
  return cartProductIds.value.has(productId)
}

function getProductQuantity(productId: string) {
  return state.cartItems.find((item) => item.id === productId)?.quantity ?? 0
}

export function useOrderStore() {
  return {
    state,
    products,
    categories,
    availableCoupons,
    filteredProducts,
    memberProfile,
    discountRate,
    subtotal,
    totalQuantity,
    memberDiscountAmount,
    selectedCoupon,
    couponDiscountAmount,
    payableAmount,
    selectedPaymentLabel,
    selectedOrderModeLabel,
    selectedTable,
    selectedTableLabel,
    availableTables,
    occupiedTables,
    checkoutDisabled,
    loadingProducts,
    submittingOrder,
    initialize,
    fetchProducts,
    addToCart,
    increaseItem,
    decreaseItem,
    fillDemoMember,
    selectTable,
    openCheckoutDialog,
    confirmOrder,
    resetOrder,
    isProductInCart,
    getProductQuantity,
  }
}
