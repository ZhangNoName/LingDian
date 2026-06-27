<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  API_BASE,
  createCategory,
  createProduct,
  getCategories,
  getOrders,
  getProducts,
  updateCategory,
  updateProduct,
  updateProductStatus,
  uploadProductImage,
  type Category,
  type OrderSummary,
  type Product,
  type ProductInput,
  type ProductStatus,
} from './services/api'

const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const orders = ref<OrderSummary[]>([])
const activeCategoryId = ref<string>('all')
const selectedProductId = ref<string>('')
const loading = ref(false)
const saving = ref(false)
const message = ref('')

const productForm = reactive({
  name: '',
  category_id: '',
  price: 0,
  stock: 0,
  description: '',
  image_url: '',
  status: 'DRAFT' as ProductStatus,
  is_featured: false,
})

const categoryForm = reactive({
  id: '',
  name: '',
  sort_order: 0,
  is_visible: true,
})

const filteredProducts = computed(() => {
  if (activeCategoryId.value === 'all') return products.value
  return products.value.filter((product) => product.category_id === activeCategoryId.value)
})

const selectedProduct = computed(() =>
  products.value.find((product) => product.id === selectedProductId.value),
)

const activeCount = computed(
  () => products.value.filter((product) => product.status === 'ACTIVE').length,
)

const productImagePreview = computed(() => {
  if (!productForm.image_url) return ''
  if (productForm.image_url.startsWith('http')) return productForm.image_url
  return `${API_BASE.replace(/\/api$/, '')}${productForm.image_url}`
})

onMounted(() => {
  void refreshAll()
})

async function refreshAll() {
  loading.value = true
  message.value = ''
  try {
    const [categoryList, productList, orderList] = await Promise.all([
      getCategories(),
      getProducts(),
      getOrders(),
    ])
    categories.value = categoryList
    products.value = productList
    orders.value = orderList
    if (!productForm.category_id && categoryList[0]) {
      productForm.category_id = categoryList[0].id
    }
  } catch (error) {
    message.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function resetProductForm() {
  selectedProductId.value = ''
  productForm.name = ''
  productForm.category_id = categories.value[0]?.id ?? ''
  productForm.price = 0
  productForm.stock = 0
  productForm.description = ''
  productForm.image_url = ''
  productForm.status = 'DRAFT'
  productForm.is_featured = false
}

function editProduct(product: Product) {
  selectedProductId.value = product.id
  productForm.name = product.name
  productForm.category_id = product.category_id
  productForm.price = product.price
  productForm.stock = product.stock
  productForm.description = product.description ?? ''
  productForm.image_url = product.image_url ?? ''
  productForm.status = product.status
  productForm.is_featured = product.is_featured
}

async function saveProduct() {
  if (!productForm.name.trim() || !productForm.category_id) {
    message.value = '请填写餐品名称并选择分类'
    return
  }

  saving.value = true
  const payload: ProductInput = {
    name: productForm.name.trim(),
    category_id: productForm.category_id,
    price: Number(productForm.price),
    stock: Number(productForm.stock),
    description: productForm.description.trim(),
    image_url: productForm.image_url.trim(),
    is_featured: productForm.is_featured,
    status: productForm.status,
  }

  try {
    if (selectedProductId.value) {
      await updateProduct(selectedProductId.value, payload)
      message.value = '餐品已更新'
    } else {
      const product = await createProduct(payload)
      selectedProductId.value = product.id
      message.value = '餐品已创建，默认处于草稿状态'
    }
    await refreshAll()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function toggleProduct(product: Product) {
  const nextStatus: ProductStatus = product.status === 'ACTIVE' ? 'SOLD_OUT' : 'ACTIVE'
  try {
    await updateProductStatus(product.id, nextStatus)
    message.value = nextStatus === 'ACTIVE' ? '已上架' : '已下架'
    await refreshAll()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '状态更新失败'
  }
}

function editCategory(category: Category) {
  categoryForm.id = category.id
  categoryForm.name = category.name
  categoryForm.sort_order = category.sort_order
  categoryForm.is_visible = category.is_visible
}

function resetCategoryForm() {
  categoryForm.id = ''
  categoryForm.name = ''
  categoryForm.sort_order = 0
  categoryForm.is_visible = true
}

async function saveCategory() {
  if (!categoryForm.name.trim()) {
    message.value = '请填写分类名称'
    return
  }

  try {
    if (categoryForm.id) {
      await updateCategory(categoryForm.id, categoryForm)
      message.value = '分类已更新'
    } else {
      await createCategory(categoryForm)
      message.value = '分类已创建'
    }
    resetCategoryForm()
    await refreshAll()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '分类保存失败'
  }
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const result = await uploadProductImage(file)
    productForm.image_url = result.url
    message.value = '图片已上传'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '图片上传失败'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">LingDian Admin</p>
        <h1>餐品管理</h1>
      </div>
      <div class="metrics">
        <span>{{ products.length }} 个餐品</span>
        <span>{{ activeCount }} 个上架</span>
        <span>{{ orders.length }} 笔订单</span>
      </div>
      <button class="primary" :disabled="loading" @click="refreshAll">刷新</button>
    </header>

    <p v-if="message" class="notice">{{ message }}</p>

    <section class="workspace">
      <aside class="panel category-panel">
        <div class="panel-title">
          <h2>分类</h2>
          <button @click="resetCategoryForm">新增</button>
        </div>
        <button
          class="category-row"
          :class="{ active: activeCategoryId === 'all' }"
          @click="activeCategoryId = 'all'"
        >
          全部餐品
        </button>
        <button
          v-for="category in categories"
          :key="category.id"
          class="category-row"
          :class="{ active: activeCategoryId === category.id }"
          @click="activeCategoryId = category.id"
          @dblclick="editCategory(category)"
        >
          <span>{{ category.name }}</span>
          <small>{{ category.is_visible ? '显示' : '隐藏' }}</small>
        </button>

        <form class="form compact" @submit.prevent="saveCategory">
          <label>
            分类名称
            <input v-model="categoryForm.name" placeholder="如：招牌饮品" />
          </label>
          <label>
            排序
            <input v-model.number="categoryForm.sort_order" type="number" min="0" />
          </label>
          <label class="check">
            <input v-model="categoryForm.is_visible" type="checkbox" />
            小程序可见
          </label>
          <button class="primary" type="submit">{{ categoryForm.id ? '保存分类' : '创建分类' }}</button>
        </form>
      </aside>

      <section class="panel product-list">
        <div class="panel-title">
          <h2>餐品</h2>
          <button @click="resetProductForm">新增餐品</button>
        </div>
        <div class="table">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            class="product-row"
            :class="{ active: selectedProductId === product.id }"
            @click="editProduct(product)"
          >
            <img v-if="product.image_url" :src="product.image_url.startsWith('http') ? product.image_url : API_BASE.replace(/\/api$/, '') + product.image_url" alt="" />
            <span v-else class="thumb">无图</span>
            <span class="product-name">{{ product.name }}</span>
            <span>¥{{ product.price.toFixed(2) }}</span>
            <span class="status" :data-status="product.status">{{ product.status }}</span>
            <span>库存入口 {{ product.stock }}</span>
          </button>
        </div>
      </section>

      <section class="panel editor">
        <div class="panel-title">
          <h2>{{ selectedProduct ? '编辑餐品' : '新增餐品' }}</h2>
          <button v-if="selectedProduct" @click="toggleProduct(selectedProduct)">
            {{ selectedProduct.status === 'ACTIVE' ? '下架' : '上架' }}
          </button>
        </div>
        <form class="form" @submit.prevent="saveProduct">
          <label>
            餐品名称
            <input v-model="productForm.name" placeholder="如：招牌拿铁" />
          </label>
          <label>
            分类
            <select v-model="productForm.category_id">
              <option disabled value="">请选择分类</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </label>
          <div class="split">
            <label>
              售价
              <input v-model.number="productForm.price" type="number" min="0" step="0.01" />
            </label>
            <label>
              库存入口
              <input v-model.number="productForm.stock" type="number" min="0" />
            </label>
          </div>
          <label>
            状态
            <select v-model="productForm.status">
              <option value="DRAFT">草稿</option>
              <option value="ACTIVE">上架</option>
              <option value="SOLD_OUT">下架</option>
              <option value="ARCHIVED">归档</option>
            </select>
          </label>
          <label>
            描述
            <textarea v-model="productForm.description" rows="4" placeholder="口味、规格、卖点" />
          </label>
          <label>
            图片地址
            <input v-model="productForm.image_url" placeholder="/uploads/products/example.jpg" />
          </label>
          <div class="upload-line">
            <input type="file" accept="image/*" @change="handleImageUpload" />
            <img v-if="productImagePreview" :src="productImagePreview" alt="" />
          </div>
          <label class="check">
            <input v-model="productForm.is_featured" type="checkbox" />
            小程序首页推荐
          </label>
          <button class="primary" type="submit" :disabled="saving">
            {{ saving ? '保存中...' : '保存餐品' }}
          </button>
        </form>
      </section>
    </section>

    <section class="panel orders">
      <div class="panel-title">
        <h2>订单同步</h2>
        <button @click="refreshAll">刷新订单</button>
      </div>
      <div class="order-table">
        <div v-for="order in orders" :key="order.id" class="order-row">
          <strong>{{ order.order_no }}</strong>
          <span>{{ order.status }}</span>
          <span>{{ order.customer_name }} {{ order.customer_mobile }}</span>
          <span>¥{{ order.payable_amount.toFixed(2) }}</span>
          <span>{{ order.item_count }} 件</span>
          <small>{{ new Date(order.created_at).toLocaleString() }}</small>
          <p>{{ order.item_summary.map((item) => `${item.name} x${item.quantity}`).join('，') }}</p>
        </div>
      </div>
    </section>
  </main>
</template>

