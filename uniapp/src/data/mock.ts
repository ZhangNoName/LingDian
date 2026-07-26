import type { CartSummary } from "@/types/cart";
import type { ProductDetail, ProductSummary } from "@/types/menu";
import type { AddOnProduct, CheckoutViewModel, OrderDetail, OrderSummary } from "@/types/order";
import type { HomeServiceMode, StoreSummary } from "@/types/store";

export const productImages = {
  burger: "/static/products/milk-green.jpg",
  combo: "/static/products/pearl-green.jpg",
  snack: "/static/products/grapefruit.jpg",
  drink: "/static/products/lime.jpg",
};

export const currentStore: StoreSummary = {
  id: "store-taoranting",
  name: "北京市西城陶然亭物美店",
  address: "北京市西城区太平街甲6号富力摩根中心DE座1434-F1-B008铺位号",
  distanceText: "距离您 1.8km",
  businessStatus: "open",
  supportModes: ["dineIn", "takeaway", "delivery"],
};

export const homeServiceModes: HomeServiceMode[] = [
  { key: "dineIn", title: "到店堂食", subtitle: "店内就餐" },
  { key: "delivery", title: "外卖到家", subtitle: "券券免配" },
];

export const menuCategories = [
  { id: "festival", name: "端午随心拼" },
  { id: "lottery", name: "送抽奖卡" },
  { id: "new", name: "鸡虾堡上新" },
  { id: "hot", name: "人气热卖" },
  { id: "single", name: "精选单人餐" },
  { id: "double", name: "分享双人餐" },
  { id: "snack", name: "小食炸鸡桶" },
];

export const products: ProductSummary[] = [
  {
    id: "combo-7",
    categoryId: "festival",
    name: "双堡随心搭7件套",
    imageUrl: productImages.burger,
    price: 38.9,
    originalPrice: 55.8,
    tags: ["超值自选"],
    hasSpec: true,
  },
  {
    id: "combo-21",
    categoryId: "lottery",
    name: "花样随心2+1",
    imageUrl: productImages.combo,
    price: 23.9,
    originalPrice: 25.8,
    tags: ["超值自选"],
    hasSpec: true,
  },
  {
    id: "combo-6",
    categoryId: "new",
    name: "端午畅选6拼餐",
    imageUrl: productImages.snack,
    price: 38.9,
    originalPrice: 40,
    tags: ["随心畅选"],
    hasSpec: true,
  },
  {
    id: "combo-8",
    categoryId: "hot",
    name: "双堡咸甜随心8拼",
    imageUrl: productImages.drink,
    price: 46.9,
    originalPrice: 62.8,
    tags: ["多选/自选"],
    hasSpec: true,
  },
  {
    id: "single-1",
    categoryId: "single",
    name: "精选单人餐",
    imageUrl: productImages.burger,
    price: 24.9,
    originalPrice: 32,
    tags: ["人气热卖"],
    hasSpec: true,
  },
  {
    id: "double-1",
    categoryId: "double",
    name: "分享双人餐",
    imageUrl: productImages.combo,
    price: 58.8,
    originalPrice: 72,
    tags: ["超值套餐"],
    hasSpec: true,
  },
  {
    id: "snack-1",
    categoryId: "snack",
    name: "小食炸鸡桶",
    imageUrl: productImages.snack,
    price: 21.9,
    originalPrice: 29.9,
    tags: ["热门小食"],
    hasSpec: true,
  },
];

export const cartSummary: CartSummary = {
  itemCount: 1,
  totalAmount: 38.9,
  discountAmount: 16.9,
  items: [
    {
      id: "cart-1",
      productId: "combo-7",
      skuId: "mock-sku-1",
      productName: "双堡随心搭7件套",
      imageUrl: productImages.burger,
      quantity: 1,
      unitPrice: 38.9,
      selectedOptions: [
        { groupId: "burger", optionId: "spicy", name: "香辣鸡腿中国汉堡", imageUrl: productImages.burger },
        { groupId: "snack", optionId: "nuggets", name: "黄金鸡块", imageUrl: productImages.snack },
        { groupId: "drink", optionId: "cola", name: "百事可乐", imageUrl: productImages.drink },
      ],
    },
  ],
};

export const productDetail: ProductDetail = {
  ...products[0],
  skuId: "mock-sku-1",
  comboImages: [productImages.combo, productImages.snack, productImages.drink],
  optionGroups: [
    {
      id: "burger",
      name: "汉堡（任选1）",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "spicy", name: "香辣鸡腿中国汉堡", imageUrl: productImages.burger },
        { id: "pepper", name: "藤椒鸡腿中国汉堡", imageUrl: productImages.combo },
        { id: "crispy", name: "黄金香酥鸡柳中国汉堡", imageUrl: productImages.snack },
        { id: "egg", name: "培根煎蛋中国汉堡", imageUrl: productImages.drink },
        { id: "shrimp", name: "脆烤鸡排中国汉堡", imageUrl: productImages.burger },
        { id: "classic", name: "原味鸡腿中国汉堡", imageUrl: productImages.combo },
      ],
    },
  ],
};

export const addOns: AddOnProduct[] = [
  { id: "panda", name: "熊猫点心", imageUrl: productImages.combo, price: 4.8, originalPrice: 8, saveText: "立省¥3.20" },
  { id: "sausage", name: "烤肠", imageUrl: productImages.snack, price: 5.8, originalPrice: 8, saveText: "立省¥2.20" },
  { id: "drink", name: "饮品", imageUrl: productImages.drink, price: 6.8, originalPrice: 8, saveText: "立省¥1.20" },
];

export const checkoutModel: CheckoutViewModel = {
  store: currentStore,
  serviceMode: "dineIn",
  pickupTimeText: "立即取餐",
  items: cartSummary.items,
  addOns,
  amount: {
    goodsAmount: 38.9,
    discountAmount: 39.99,
    couponAmount: 0.01,
    payableAmount: 38.9,
  },
};

export const orders: OrderSummary[] = [
  {
    id: "LD202606210001",
    storeName: "北京市西城陶然亭物美店",
    serviceMode: "dineIn",
    status: "making",
    createdAt: "2026-06-21 12:35:18",
    totalAmount: 38.9,
    itemCount: 1,
    productThumbs: [productImages.burger, productImages.combo],
  },
  {
    id: "LD202606150001",
    storeName: "北京市海淀五道口店",
    serviceMode: "dineIn",
    status: "finished",
    createdAt: "2026-06-15 18:28:27",
    totalAmount: 21.9,
    itemCount: 2,
    productThumbs: [productImages.burger, productImages.snack],
  },
];

export const orderDetails: Record<string, OrderDetail> = {
  LD202606150001: {
    ...orders[1],
    storeAddress: "北京市海淀区五道口商圈A座一层",
    rewardPoints: 21,
    goodsAmount: 35.9,
    discountTitle: "香辣鸡腿堡-回归老客专享",
    discountAmount: 14,
    pickupNo: "526",
    expectedTime: "立即取餐",
    servedAt: "2026/06/15 18:34:17",
    paymentMethod: "微信支付",
    remark: "无",
    items: [
      {
        id: "detail-burger",
        name: "香辣鸡腿中国汉堡",
        imageUrl: productImages.burger,
        quantity: 1,
        price: 14,
      },
      {
        id: "detail-bucket",
        name: "六六大顺辣翅桶",
        imageUrl: productImages.snack,
        quantity: 1,
        price: 21.9,
        tag: "人气爆款",
        specs: ["1 x 六六大顺桶（含3对香辣鸡翅）"],
      },
    ],
    infoRows: [
      { label: "期望时间", value: "立即取餐" },
      { label: "备注", value: "无" },
      { label: "订单类型", value: "堂食" },
      { label: "取餐号", value: "526" },
      { label: "订单编号", value: "11781519307648606247069", copyable: true },
      { label: "下单时间", value: "2026/06/15 18:28:27" },
      { label: "出餐时间", value: "2026/06/15 18:34:17" },
      { label: "支付方式", value: "微信支付" },
    ],
  },
  LD202606210001: {
    ...orders[0],
    storeAddress: currentStore.address,
    rewardPoints: 38,
    goodsAmount: 38.9,
    discountTitle: "随心搭套餐优惠",
    discountAmount: 16.9,
    pickupNo: "318",
    expectedTime: "立即取餐",
    servedAt: "制作中",
    paymentMethod: "微信支付",
    remark: "无",
    items: [
      {
        id: "detail-combo",
        name: "双堡随心搭7件套",
        imageUrl: productImages.burger,
        quantity: 1,
        price: 38.9,
        tag: "超值自选",
        specs: ["1 x 香辣鸡腿中国汉堡", "1 x 黄金鸡块", "1 x 百事可乐"],
      },
    ],
    infoRows: [
      { label: "期望时间", value: "立即取餐" },
      { label: "备注", value: "无" },
      { label: "订单类型", value: "堂食" },
      { label: "取餐号", value: "318" },
      { label: "订单编号", value: "11781519307648606247070", copyable: true },
      { label: "下单时间", value: "2026/06/21 12:35:18" },
      { label: "出餐时间", value: "制作中" },
      { label: "支付方式", value: "微信支付" },
    ],
  },
};
