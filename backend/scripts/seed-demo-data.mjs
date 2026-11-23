import 'dotenv/config';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  OrderStatus,
  OrderType,
  PaymentChannel,
  createMariaDbConnectionConfig,
  PrismaClient,
  ProductStatus,
  ProductType,
  SelectionGroupType,
  SelectionMode,
  SelectionOptionType,
  SelectionScope,
  StoreStatus,
} from '@lingdian/db';
import { createLocalMerchantInTransaction, isLocalMerchantSeedAllowed } from './auth-bootstrap.lib.mjs';
import {
  assertDemoSeedAllowed,
  clearPrimaryStoreDemoData,
} from './demo-seed-safety.mjs';

const databaseUrl = process.env.DATABASE_URL;
const primaryStoreId = process.env.PRIMARY_STORE_ID?.trim();

assertDemoSeedAllowed(process.env);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}
if (!primaryStoreId) {
  throw new Error('PRIMARY_STORE_ID is required so the demo seed cannot change the runtime store identity.');
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(createMariaDbConnectionConfig(databaseUrl, {
    requireTls: process.env.DATABASE_MODE === 'external' ||
      (process.env.NODE_ENV === 'production' && process.env.DATABASE_MODE !== 'local'),
  })),
});

const storeSeed = {
  code: 'SWIFTBITE-DEMO',
  name: 'SwiftBite Demo Store',
  contactName: 'Demo Manager',
  contactPhone: '13800000000',
  address: 'Shanghai Pudong New Area Demo Road 88',
  businessHours: '09:00-22:30',
  status: StoreStatus.OPEN,
  dineInEnabled: true,
  takeoutEnabled: true,
  pickupEnabled: true,
};

const catalogSeed = [
  {
    key: 'burgers',
    name: '汉堡',
    sortOrder: 1,
    products: [
      {
        key: 'spicy-chicken-burger',
        type: ProductType.SINGLE,
        name: '香辣鸡腿堡',
        description: '酥脆鸡腿排、生菜和香辣酱，夹在芝麻面包里。',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'single', skuName: '单层', price: 19.9, stockCount: 120, isDefault: true },
          { key: 'double', skuName: '双层', price: 27.9, stockCount: 60, isDefault: false },
        ],
      },
      {
        key: 'grilled-chicken-burger',
        type: ProductType.SINGLE,
        name: '黑椒烤鸡堡',
        description: '炭烤鸡腿肉搭配黑椒酱和脆生菜。',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'single', skuName: '单层', price: 21.9, stockCount: 96, isDefault: true },
        ],
      },
      {
        key: 'beef-bacon-burger',
        type: ProductType.SINGLE,
        name: '芝士培根牛肉堡',
        description: '牛肉饼叠上香煎培根和融化的芝士。',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'single', skuName: '单层', price: 28.9, stockCount: 48, isDefault: true },
        ],
      },
    ],
  },
  {
    key: 'snacks',
    name: '小吃',
    sortOrder: 2,
    products: [
      {
        key: 'fries',
        type: ProductType.SINGLE,
        name: '黄金薯条',
        description: '现炸金黄薯条，外脆内软。',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'medium', skuName: '中份', price: 11.9, stockCount: 180, isDefault: true },
          { key: 'large', skuName: '大份', price: 15.9, stockCount: 120, isDefault: false },
        ],
      },
      {
        key: 'popcorn-chicken',
        type: ProductType.SINGLE,
        name: '香酥鸡米花',
        description: '一口大小的酥炸鸡块，带一点辣味。',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'small', skuName: '小份', price: 13.9, stockCount: 88, isDefault: true },
          { key: 'share', skuName: '分享装', price: 22.9, stockCount: 40, isDefault: false },
        ],
      },
    ],
  },
  {
    key: 'drinks',
    name: '饮料',
    sortOrder: 3,
    products: [
      {
        key: 'cola',
        type: ProductType.SINGLE,
        name: '冰可乐',
        description: '带气泡的经典冰爽可乐。',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'medium', skuName: '中杯', price: 8.5, stockCount: 150, isDefault: true },
          { key: 'large', skuName: '大杯', price: 10.5, stockCount: 110, isDefault: false },
        ],
      },
      {
        key: 'fruit-drink',
        type: ProductType.SINGLE,
        name: '冰橙饮',
        description: '冰爽橙味果饮，可搭配套餐。',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'medium', skuName: '中杯', price: 10.9, stockCount: 90, isDefault: true },
        ],
      },
    ],
  },
  {
    key: 'combos',
    name: '套餐',
    sortOrder: 0,
    products: [
      {
        key: 'classic-burger-combo',
        type: ProductType.PACKAGE,
        name: '经典鸡腿堡套餐',
        description: '香辣鸡腿堡、黄金薯条和冰可乐，可替换主食、小吃或饮料。',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'standard', skuName: '标准套餐', price: 36.9, stockCount: 80, isDefault: true },
        ],
      },
    ],
  },
];

const demoOrders = [
  {
    orderNo: 'LD202604300001',
    customerName: '张三',
    customerMobile: '13811110001',
    orderType: OrderType.DINE_IN,
    status: OrderStatus.PAID,
    paymentChannel: PaymentChannel.WECHAT,
    remark: '少冰，先上饮料',
    createdAt: new Date('2026-04-29T11:08:00+08:00'),
    updatedAt: new Date('2026-04-29T11:16:00+08:00'),
    paidAt: new Date('2026-04-29T11:11:00+08:00'),
    items: [
      {
        skuKey: 'classic-burger-combo:standard',
        quantity: 1,
        remark: '汉堡不要番茄',
        selections: ['burger:spicy', 'snack:fries', 'drink:cola'],
      },
      {
        skuKey: 'cola:large',
        quantity: 1,
        remark: '少冰',
        selections: ['ice:less'],
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-29T11:08:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '等待顾客支付',
        createdAt: new Date('2026-04-29T11:09:00+08:00'),
      },
      {
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.PAID,
        note: '微信支付成功',
        operatorName: '收银员-A',
        createdAt: new Date('2026-04-29T11:11:00+08:00'),
      },
    ],
  },
  {
    orderNo: 'LD202604300002',
    customerName: '李女士',
    customerMobile: '13811110002',
    orderType: OrderType.TAKEOUT,
    status: OrderStatus.PENDING_PAYMENT,
    paymentChannel: PaymentChannel.CUSTOMER_SCAN,
    remark: '外卖尽快出餐',
    createdAt: new Date('2026-04-29T12:18:00+08:00'),
    updatedAt: new Date('2026-04-29T12:18:00+08:00'),
    items: [
      {
        skuKey: 'spicy-chicken-burger:double',
        quantity: 2,
        remark: '一份微辣一份正常',
        selections: ['spice:mild', 'addon:cheese'],
      },
      {
        skuKey: 'fries:large',
        quantity: 1,
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-29T12:18:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '用户待扫码付款',
        createdAt: new Date('2026-04-29T12:18:30+08:00'),
      },
    ],
  },
  {
    orderNo: 'LD202604300003',
    customerName: '王先生',
    customerMobile: '13811110003',
    orderType: OrderType.TAKEOUT,
    status: OrderStatus.COMPLETED,
    paymentChannel: PaymentChannel.ALIPAY,
    remark: '不要辣，电话联系',
    createdAt: new Date('2026-04-28T18:02:00+08:00'),
    updatedAt: new Date('2026-04-28T18:39:00+08:00'),
    paidAt: new Date('2026-04-28T18:05:00+08:00'),
    items: [
      {
        skuKey: 'grilled-chicken-burger:single',
        quantity: 1,
        selections: ['veggie:no-tomato'],
      },
      {
        skuKey: 'popcorn-chicken:share',
        quantity: 1,
      },
      {
        skuKey: 'fruit-drink:medium',
        quantity: 1,
        selections: ['ice:no'],
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-28T18:02:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '等待支付',
        createdAt: new Date('2026-04-28T18:03:00+08:00'),
      },
      {
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.PAID,
        note: '支付宝支付完成',
        operatorName: '系统',
        createdAt: new Date('2026-04-28T18:05:00+08:00'),
      },
      {
        fromStatus: OrderStatus.PAID,
        toStatus: OrderStatus.PREPARING,
        note: '后厨开始制作',
        operatorName: '后厨-1',
        createdAt: new Date('2026-04-28T18:08:00+08:00'),
      },
      {
        fromStatus: OrderStatus.PREPARING,
        toStatus: OrderStatus.READY,
        note: '已打包完成',
        operatorName: '后厨-1',
        createdAt: new Date('2026-04-28T18:22:00+08:00'),
      },
      {
        fromStatus: OrderStatus.READY,
        toStatus: OrderStatus.COMPLETED,
        note: '骑手已取餐',
        operatorName: '配送员',
        createdAt: new Date('2026-04-28T18:39:00+08:00'),
      },
    ],
  },
  {
    orderNo: 'LD202604300004',
    customerName: '赵女士',
    customerMobile: '13811110004',
    orderType: OrderType.DINE_IN,
    status: OrderStatus.REFUNDING,
    paymentChannel: PaymentChannel.CASH,
    remark: '顾客临时改口味，申请退款',
    createdAt: new Date('2026-04-29T19:12:00+08:00'),
    updatedAt: new Date('2026-04-29T19:28:00+08:00'),
    paidAt: new Date('2026-04-29T19:13:00+08:00'),
    refundingAt: new Date('2026-04-29T19:28:00+08:00'),
    items: [
      {
        skuKey: 'beef-bacon-burger:single',
        quantity: 1,
      },
      {
        skuKey: 'cola:medium',
        quantity: 1,
        selections: ['ice:regular'],
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-29T19:12:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '等待付款',
        createdAt: new Date('2026-04-29T19:12:30+08:00'),
      },
      {
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.PAID,
        note: '现金收款完成',
        operatorName: '收银员-B',
        createdAt: new Date('2026-04-29T19:13:00+08:00'),
      },
      {
        fromStatus: OrderStatus.PAID,
        toStatus: OrderStatus.REFUNDING,
        note: '顾客发起退款',
        operatorName: '店长',
        createdAt: new Date('2026-04-29T19:28:00+08:00'),
      },
    ],
  },
  {
    orderNo: 'LD202604300005',
    customerName: '陈先生',
    customerMobile: '13811110005',
    orderType: OrderType.PICKUP,
    status: OrderStatus.REFUNDED,
    paymentChannel: PaymentChannel.WECHAT,
    remark: '顾客重复下单，已退款',
    createdAt: new Date('2026-04-27T10:06:00+08:00'),
    updatedAt: new Date('2026-04-27T10:26:00+08:00'),
    paidAt: new Date('2026-04-27T10:08:00+08:00'),
    refundingAt: new Date('2026-04-27T10:17:00+08:00'),
    refundedAt: new Date('2026-04-27T10:26:00+08:00'),
    items: [
      {
        skuKey: 'classic-burger-combo:standard',
        quantity: 1,
        selections: ['burger:grilled', 'snack:chicken', 'drink:fruit'],
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-27T10:06:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '等待支付',
        createdAt: new Date('2026-04-27T10:06:30+08:00'),
      },
      {
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.PAID,
        note: '微信支付完成',
        operatorName: '系统',
        createdAt: new Date('2026-04-27T10:08:00+08:00'),
      },
      {
        fromStatus: OrderStatus.PAID,
        toStatus: OrderStatus.REFUNDING,
        note: '顾客申请退款',
        operatorName: '客服',
        createdAt: new Date('2026-04-27T10:17:00+08:00'),
      },
      {
        fromStatus: OrderStatus.REFUNDING,
        toStatus: OrderStatus.REFUNDED,
        note: '退款成功',
        operatorName: '财务',
        createdAt: new Date('2026-04-27T10:26:00+08:00'),
      },
    ],
  },
  {
    orderNo: 'LD202604300006',
    customerName: '周小姐',
    customerMobile: '13811110006',
    orderType: OrderType.TAKEOUT,
    status: OrderStatus.CANCELLED,
    paymentChannel: PaymentChannel.OTHER,
    remark: '用户主动取消',
    createdAt: new Date('2026-04-30T09:40:00+08:00'),
    updatedAt: new Date('2026-04-30T09:45:00+08:00'),
    cancelledAt: new Date('2026-04-30T09:45:00+08:00'),
    items: [
      {
        skuKey: 'fries:medium',
        quantity: 1,
      },
      {
        skuKey: 'cola:medium',
        quantity: 1,
        selections: ['ice:regular'],
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-30T09:40:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '待付款',
        createdAt: new Date('2026-04-30T09:41:00+08:00'),
      },
      {
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.CANCELLED,
        note: '顾客取消订单',
        operatorName: '顾客',
        createdAt: new Date('2026-04-30T09:45:00+08:00'),
      },
    ],
  },
  {
    orderNo: 'LD202604300007',
    customerName: '吴先生',
    customerMobile: '13811110007',
    orderType: OrderType.DINE_IN,
    status: OrderStatus.TIMED_OUT,
    paymentChannel: PaymentChannel.CUSTOMER_SCAN,
    remark: '超时未支付',
    createdAt: new Date('2026-04-30T14:03:00+08:00'),
    updatedAt: new Date('2026-04-30T14:18:00+08:00'),
    items: [
      {
        skuKey: 'spicy-chicken-burger:single',
        quantity: 1,
        selections: ['spice:hot', 'veggie:pickles'],
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-30T14:03:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '等待顾客扫码支付',
        createdAt: new Date('2026-04-30T14:03:30+08:00'),
      },
      {
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.TIMED_OUT,
        note: '超过支付时限自动关闭',
        operatorName: '系统',
        createdAt: new Date('2026-04-30T14:18:00+08:00'),
      },
    ],
  },
  {
    orderNo: 'LD202604300008',
    customerName: '郑女士',
    customerMobile: '13811110008',
    orderType: OrderType.PICKUP,
    status: OrderStatus.FAILED,
    paymentChannel: PaymentChannel.ALIPAY,
    remark: '下单后库存校验失败',
    createdAt: new Date('2026-04-30T16:20:00+08:00'),
    updatedAt: new Date('2026-04-30T16:23:00+08:00'),
    items: [
      {
        skuKey: 'popcorn-chicken:small',
        quantity: 1,
      },
    ],
    logs: [
      {
        fromStatus: null,
        toStatus: OrderStatus.CREATING,
        note: '订单创建',
        createdAt: new Date('2026-04-30T16:20:00+08:00'),
      },
      {
        fromStatus: OrderStatus.CREATING,
        toStatus: OrderStatus.PENDING_PAYMENT,
        note: '进入待支付',
        createdAt: new Date('2026-04-30T16:20:30+08:00'),
      },
      {
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.FAILED,
        note: '库存不足，订单失败',
        operatorName: '系统',
        createdAt: new Date('2026-04-30T16:23:00+08:00'),
      },
    ],
  },
];

function buildSelectionReferenceMap(selectionGroups) {
  const map = new Map();

  for (const group of selectionGroups) {
    for (const option of group.options) {
      map.set(`${group.name}:${option.name}`, {
        groupId: group.id,
        optionId: option.id,
        groupName: group.name,
        optionName: option.name,
        optionType: option.optionType,
        referencedSkuId: option.referencedSkuId ?? null,
        referencedSkuName: option.referencedSku?.skuName ?? null,
        priceDelta: Number(option.priceDelta),
      });
    }
  }

  return map;
}

function computeOrderAmounts(orderItems) {
  return orderItems.reduce(
    (sum, item) => sum + Number(item.subtotal),
    0,
  );
}

async function main() {
  const imageDirectory = join(process.cwd(), 'uploads', 'products', 'demo');
  await mkdir(imageDirectory, { recursive: true });
  await Promise.all(catalogSeed.flatMap(({ products }) => products.map(({ key }) =>
    copyFile(new URL(`./demo-assets/${key}.jpg`, import.meta.url), join(imageDirectory, `${key}.jpg`)),
  )));

  const merchant = await prisma.$transaction(async (tx) => {
    await clearPrimaryStoreDemoData(tx, primaryStoreId);
    const store = await tx.store.upsert({
      where: { id: primaryStoreId },
      create: { id: primaryStoreId, ...storeSeed },
      update: storeSeed,
    });

    const skuMap = new Map();
    const productMap = new Map();

    for (const categorySeed of catalogSeed) {
      const category = await tx.category.create({
        data: {
          storeId: store.id,
          name: categorySeed.name,
          sortOrder: categorySeed.sortOrder,
          isVisible: true,
        },
      });

      for (const productSeed of categorySeed.products) {
        const stock = productSeed.skus.reduce((sum, sku) => sum + sku.stockCount, 0);
        const basePrice = productSeed.skus[0]?.price ?? 0;

        const product = await tx.product.create({
          data: {
            storeId: store.id,
            categoryId: category.id,
            name: productSeed.name,
            description: productSeed.description,
            imageUrl: `/uploads/products/demo/${productSeed.key}.jpg`,
            type: productSeed.type,
            price: basePrice,
            status: productSeed.status,
            isFeatured: productSeed.isFeatured,
            stock,
            skus: {
              create: productSeed.skus.map((sku) => ({
                skuName: sku.skuName,
                price: sku.price,
                stockCount: sku.stockCount,
                isDefault: sku.isDefault,
                isActive: true,
              })),
            },
          },
          include: {
            skus: true,
          },
        });

        productMap.set(productSeed.key, product);

        for (const skuSeed of productSeed.skus) {
          const savedSku = product.skus.find((sku) => sku.skuName === skuSeed.skuName);
          if (savedSku) {
            skuMap.set(`${productSeed.key}:${skuSeed.key}`, savedSku.id);
          }
        }
      }
    }

    const spicyLevelGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: '辣度',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 0,
        options: {
          create: [
            { name: '不辣', optionType: SelectionOptionType.VALUE, isDefault: false, sortOrder: 0 },
            { name: '微辣', optionType: SelectionOptionType.VALUE, isDefault: true, sortOrder: 1 },
            { name: '香辣', optionType: SelectionOptionType.VALUE, isDefault: false, sortOrder: 2 },
          ],
        },
      },
    });

    const veggieAdjustGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: '配菜调整',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.MULTIPLE,
        minSelect: 0,
        maxSelect: 3,
        isRequired: false,
        sortOrder: 1,
        options: {
          create: [
            { name: '去生菜', optionType: SelectionOptionType.VALUE, sortOrder: 0 },
            { name: '去番茄', optionType: SelectionOptionType.VALUE, sortOrder: 1 },
            { name: '加酸黄瓜', optionType: SelectionOptionType.VALUE, priceDelta: 1, sortOrder: 2 },
          ],
        },
      },
    });

    const addOnGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: '加料',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.MULTIPLE,
        minSelect: 0,
        maxSelect: 2,
        isRequired: false,
        sortOrder: 2,
        options: {
          create: [
            { name: '加芝士', optionType: SelectionOptionType.VALUE, priceDelta: 2, sortOrder: 0 },
            { name: '加培根', optionType: SelectionOptionType.VALUE, priceDelta: 4, sortOrder: 1 },
          ],
        },
      },
    });

    const iceLevelGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: '冰量',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 3,
        options: {
          create: [
            { name: '正常冰', optionType: SelectionOptionType.VALUE, isDefault: true, sortOrder: 0 },
            { name: '少冰', optionType: SelectionOptionType.VALUE, sortOrder: 1 },
            { name: '去冰', optionType: SelectionOptionType.VALUE, sortOrder: 2 },
          ],
        },
      },
    });

    const burgerChoiceGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: '主食',
        groupType: SelectionGroupType.COMPONENT,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 4,
        options: {
          create: [
            {
              name: '香辣鸡腿堡',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('spicy-chicken-burger:single'),
              sortOrder: 0,
            },
            {
              name: '黑椒烤鸡堡',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('grilled-chicken-burger:single'),
              priceDelta: 2,
              sortOrder: 1,
            },
            {
              name: '芝士培根牛肉堡',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('beef-bacon-burger:single'),
              priceDelta: 6,
              sortOrder: 2,
            },
          ],
        },
      },
    });

    const snackChoiceGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: '小吃',
        groupType: SelectionGroupType.COMPONENT,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 5,
        options: {
          create: [
            {
              name: '黄金薯条（中份）',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('fries:medium'),
              sortOrder: 0,
            },
            {
              name: '香酥鸡米花（小份）',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('popcorn-chicken:small'),
              priceDelta: 2,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    const drinkChoiceGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: '饮料',
        groupType: SelectionGroupType.COMPONENT,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 6,
        options: {
          create: [
            {
              name: '冰可乐（中杯）',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('cola:medium'),
              sortOrder: 0,
            },
            {
              name: '冰橙饮（中杯）',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('fruit-drink:medium'),
              priceDelta: 2,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    await tx.productSelectionGroup.createMany({
      data: [
        {
          productId: productMap.get('spicy-chicken-burger').id,
          groupId: spicyLevelGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 0,
          isEnabled: true,
        },
        {
          productId: productMap.get('spicy-chicken-burger').id,
          groupId: veggieAdjustGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 1,
          isEnabled: true,
        },
        {
          productId: productMap.get('spicy-chicken-burger').id,
          groupId: addOnGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 2,
          isEnabled: true,
        },
        {
          productId: productMap.get('grilled-chicken-burger').id,
          groupId: veggieAdjustGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 0,
          isEnabled: true,
        },
        {
          productId: productMap.get('grilled-chicken-burger').id,
          groupId: addOnGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 1,
          isEnabled: true,
        },
        {
          productId: productMap.get('cola').id,
          groupId: iceLevelGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 0,
          isEnabled: true,
        },
        {
          productId: productMap.get('fruit-drink').id,
          groupId: iceLevelGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 0,
          isEnabled: true,
        },
        {
          productId: productMap.get('classic-burger-combo').id,
          groupId: burgerChoiceGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 0,
          isEnabled: true,
        },
        {
          productId: productMap.get('classic-burger-combo').id,
          groupId: snackChoiceGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 1,
          isEnabled: true,
        },
        {
          productId: productMap.get('classic-burger-combo').id,
          groupId: drinkChoiceGroup.id,
          scope: SelectionScope.PRODUCT,
          sortOrder: 2,
          isEnabled: true,
        },
      ],
    });

    const selectionGroups = await tx.selectionGroup.findMany({
      where: {
        storeId: store.id,
      },
      include: {
        options: {
          include: {
            referencedSku: true,
          },
        },
      },
    });

    const selectionReferenceMap = buildSelectionReferenceMap(selectionGroups);
    const selectionAliasMap = new Map([
      ['spice:no', selectionReferenceMap.get('辣度:不辣')],
      ['spice:mild', selectionReferenceMap.get('辣度:微辣')],
      ['spice:hot', selectionReferenceMap.get('辣度:香辣')],
      ['veggie:no-lettuce', selectionReferenceMap.get('配菜调整:去生菜')],
      ['veggie:no-tomato', selectionReferenceMap.get('配菜调整:去番茄')],
      ['veggie:pickles', selectionReferenceMap.get('配菜调整:加酸黄瓜')],
      ['addon:cheese', selectionReferenceMap.get('加料:加芝士')],
      ['addon:bacon', selectionReferenceMap.get('加料:加培根')],
      ['ice:regular', selectionReferenceMap.get('冰量:正常冰')],
      ['ice:less', selectionReferenceMap.get('冰量:少冰')],
      ['ice:no', selectionReferenceMap.get('冰量:去冰')],
      ['burger:spicy', selectionReferenceMap.get('主食:香辣鸡腿堡')],
      ['burger:grilled', selectionReferenceMap.get('主食:黑椒烤鸡堡')],
      ['burger:beef', selectionReferenceMap.get('主食:芝士培根牛肉堡')],
      ['snack:fries', selectionReferenceMap.get('小吃:黄金薯条（中份）')],
      ['snack:chicken', selectionReferenceMap.get('小吃:香酥鸡米花（小份）')],
      ['drink:cola', selectionReferenceMap.get('饮料:冰可乐（中杯）')],
      ['drink:fruit', selectionReferenceMap.get('饮料:冰橙饮（中杯）')],
    ]);

    for (const demoOrder of demoOrders) {
      const orderItems = demoOrder.items.map((item) => {
        const skuId = skuMap.get(item.skuKey);
        if (!skuId) {
          throw new Error(`Missing sku for ${item.skuKey}`);
        }

        const productKey = item.skuKey.split(':')[0];
        const product = productMap.get(productKey);
        if (!product) {
          throw new Error(`Missing product for ${productKey}`);
        }

        const sku = product.skus.find((entry) => entry.id === skuId);
        if (!sku) {
          throw new Error(`Missing saved sku entity for ${item.skuKey}`);
        }

        const selections = (item.selections ?? []).map((selectionKey) => {
          const selection = selectionAliasMap.get(selectionKey);
          if (!selection) {
            throw new Error(`Missing selection for ${selectionKey}`);
          }

          return {
            selectionGroupId: selection.groupId,
            selectionOptionId: selection.optionId,
            groupNameSnapshot: selection.groupName,
            optionNameSnapshot: selection.optionName,
            optionType: selection.optionType,
            referencedSkuId: selection.referencedSkuId,
            referencedSkuName: selection.referencedSkuName,
            priceDelta: selection.priceDelta,
            quantity: 1,
          };
        });

        const subtotal =
          Number(sku.price) * item.quantity +
          selections.reduce((sum, selection) => sum + Number(selection.priceDelta), 0);

        return {
          productId: product.id,
          skuId: sku.id,
          productName: product.name,
          skuName: sku.skuName,
          unitPrice: Number(sku.price),
          quantity: item.quantity,
          subtotal,
          remark: item.remark ?? null,
          selections: {
            create: selections,
          },
        };
      });

      const amount = computeOrderAmounts(orderItems);

      await tx.order.create({
        data: {
          orderNo: demoOrder.orderNo,
          storeId: store.id,
          customerName: demoOrder.customerName,
          customerMobile: demoOrder.customerMobile,
          orderType: demoOrder.orderType,
          status: demoOrder.status,
          paymentChannel: demoOrder.paymentChannel,
          totalAmount: amount,
          payableAmount: amount,
          remark: demoOrder.remark,
          createdAt: demoOrder.createdAt,
          updatedAt: demoOrder.updatedAt,
          paidAt: demoOrder.paidAt ?? null,
          cancelledAt: demoOrder.cancelledAt ?? null,
          refundingAt: demoOrder.refundingAt ?? null,
          refundedAt: demoOrder.refundedAt ?? null,
          items: {
            create: orderItems,
          },
          statusLogs: {
            create: demoOrder.logs,
          },
        },
      });
    }
    if (isLocalMerchantSeedAllowed(process.env)) return createLocalMerchantInTransaction(tx, store.id);
  });

  const [stores, categories, products, skus, groups, options, bindings, orders, orderLogs] = await Promise.all([
    prisma.store.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productSKU.count(),
    prisma.selectionGroup.count(),
    prisma.selectionOption.count(),
    prisma.productSelectionGroup.count(),
    prisma.order.count(),
    prisma.orderStatusLog.count(),
  ]);

  console.log(
    `Demo seed complete: ${stores} store(s), ${categories} categories, ${products} products, ${skus} skus, ${groups} groups, ${options} options, ${bindings} bindings, ${orders} orders, ${orderLogs} order logs.`,
  );
  console.log(`Configured primary store: PRIMARY_STORE_ID=${primaryStoreId}`);
  if (merchant) console.log(`Default merchant ${merchant}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
