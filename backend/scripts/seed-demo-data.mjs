import 'dotenv/config';
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
    name: 'Burgers',
    sortOrder: 1,
    products: [
      {
        key: 'spicy-chicken-burger',
        type: ProductType.SINGLE,
        name: 'Spicy Chicken Burger',
        description: 'Crispy chicken thigh burger with lettuce and spicy sauce.',
        imageUrl: 'https://example.com/demo/spicy-chicken-burger.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'single', skuName: 'Single', price: 19.9, stockCount: 120, isDefault: true },
          { key: 'double', skuName: 'Double Patty', price: 27.9, stockCount: 60, isDefault: false },
        ],
      },
      {
        key: 'grilled-chicken-burger',
        type: ProductType.SINGLE,
        name: 'Grilled Chicken Burger',
        description: 'Grilled chicken burger with black pepper sauce.',
        imageUrl: 'https://example.com/demo/grilled-chicken-burger.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'single', skuName: 'Single', price: 21.9, stockCount: 96, isDefault: true },
        ],
      },
      {
        key: 'beef-bacon-burger',
        type: ProductType.SINGLE,
        name: 'Beef Bacon Burger',
        description: 'Beef patty layered with bacon and cheese.',
        imageUrl: 'https://example.com/demo/beef-bacon-burger.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'single', skuName: 'Single', price: 28.9, stockCount: 48, isDefault: true },
        ],
      },
    ],
  },
  {
    key: 'snacks',
    name: 'Snacks',
    sortOrder: 2,
    products: [
      {
        key: 'fries',
        type: ProductType.SINGLE,
        name: 'Golden Fries',
        description: 'Fresh fried fries with crispy texture.',
        imageUrl: 'https://example.com/demo/fries.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'medium', skuName: 'Medium', price: 11.9, stockCount: 180, isDefault: true },
          { key: 'large', skuName: 'Large', price: 15.9, stockCount: 120, isDefault: false },
        ],
      },
      {
        key: 'popcorn-chicken',
        type: ProductType.SINGLE,
        name: 'Popcorn Chicken',
        description: 'Small crispy chicken bites with mild spice.',
        imageUrl: 'https://example.com/demo/popcorn-chicken.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'small', skuName: 'Small', price: 13.9, stockCount: 88, isDefault: true },
          { key: 'share', skuName: 'Sharing', price: 22.9, stockCount: 40, isDefault: false },
        ],
      },
    ],
  },
  {
    key: 'drinks',
    name: 'Drinks',
    sortOrder: 3,
    products: [
      {
        key: 'cola',
        type: ProductType.SINGLE,
        name: 'Cola',
        description: 'Classic sparkling cola drink.',
        imageUrl: 'https://example.com/demo/cola.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'medium', skuName: 'Medium', price: 8.5, stockCount: 150, isDefault: true },
          { key: 'large', skuName: 'Large', price: 10.5, stockCount: 110, isDefault: false },
        ],
      },
      {
        key: 'fruit-drink',
        type: ProductType.SINGLE,
        name: 'Fruit Drink',
        description: 'Sweet mixed fruit drink for combo upgrades.',
        imageUrl: 'https://example.com/demo/fruit-drink.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { key: 'medium', skuName: 'Medium', price: 10.9, stockCount: 90, isDefault: true },
        ],
      },
    ],
  },
  {
    key: 'combos',
    name: 'Combos',
    sortOrder: 4,
    products: [
      {
        key: 'classic-burger-combo',
        type: ProductType.PACKAGE,
        name: 'Classic Burger Combo',
        description: 'One burger, one snack, and one drink. Choose your own combination.',
        imageUrl: 'https://example.com/demo/classic-burger-combo.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { key: 'standard', skuName: 'Standard Combo', price: 36.9, stockCount: 80, isDefault: true },
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
  await prisma.$transaction(async (tx) => {
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
            imageUrl: productSeed.imageUrl,
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
        name: 'Spice Level',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 0,
        options: {
          create: [
            { name: 'No Spice', optionType: SelectionOptionType.VALUE, isDefault: false, sortOrder: 0 },
            { name: 'Mild', optionType: SelectionOptionType.VALUE, isDefault: true, sortOrder: 1 },
            { name: 'Hot', optionType: SelectionOptionType.VALUE, isDefault: false, sortOrder: 2 },
          ],
        },
      },
    });

    const veggieAdjustGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: 'Veggie Adjustments',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.MULTIPLE,
        minSelect: 0,
        maxSelect: 3,
        isRequired: false,
        sortOrder: 1,
        options: {
          create: [
            { name: 'No Lettuce', optionType: SelectionOptionType.VALUE, sortOrder: 0 },
            { name: 'No Tomato', optionType: SelectionOptionType.VALUE, sortOrder: 1 },
            { name: 'Extra Pickles', optionType: SelectionOptionType.VALUE, priceDelta: 1, sortOrder: 2 },
          ],
        },
      },
    });

    const addOnGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: 'Add-ons',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.MULTIPLE,
        minSelect: 0,
        maxSelect: 2,
        isRequired: false,
        sortOrder: 2,
        options: {
          create: [
            { name: 'Add Cheese', optionType: SelectionOptionType.VALUE, priceDelta: 2, sortOrder: 0 },
            { name: 'Add Bacon', optionType: SelectionOptionType.VALUE, priceDelta: 4, sortOrder: 1 },
          ],
        },
      },
    });

    const iceLevelGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: 'Ice Level',
        groupType: SelectionGroupType.MODIFIER,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 3,
        options: {
          create: [
            { name: 'Regular Ice', optionType: SelectionOptionType.VALUE, isDefault: true, sortOrder: 0 },
            { name: 'Less Ice', optionType: SelectionOptionType.VALUE, sortOrder: 1 },
            { name: 'No Ice', optionType: SelectionOptionType.VALUE, sortOrder: 2 },
          ],
        },
      },
    });

    const burgerChoiceGroup = await tx.selectionGroup.create({
      data: {
        storeId: store.id,
        name: 'Burger Choice',
        groupType: SelectionGroupType.COMPONENT,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 4,
        options: {
          create: [
            {
              name: 'Spicy Chicken Burger',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('spicy-chicken-burger:single'),
              sortOrder: 0,
            },
            {
              name: 'Grilled Chicken Burger',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('grilled-chicken-burger:single'),
              priceDelta: 2,
              sortOrder: 1,
            },
            {
              name: 'Beef Bacon Burger',
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
        name: 'Snack Choice',
        groupType: SelectionGroupType.COMPONENT,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 5,
        options: {
          create: [
            {
              name: 'Golden Fries Medium',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('fries:medium'),
              sortOrder: 0,
            },
            {
              name: 'Popcorn Chicken Small',
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
        name: 'Drink Choice',
        groupType: SelectionGroupType.COMPONENT,
        selectionMode: SelectionMode.SINGLE,
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 6,
        options: {
          create: [
            {
              name: 'Cola Medium',
              optionType: SelectionOptionType.VARIANT,
              referencedSkuId: skuMap.get('cola:medium'),
              sortOrder: 0,
            },
            {
              name: 'Fruit Drink Medium',
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
      ['spice:no', selectionReferenceMap.get('Spice Level:No Spice')],
      ['spice:mild', selectionReferenceMap.get('Spice Level:Mild')],
      ['spice:hot', selectionReferenceMap.get('Spice Level:Hot')],
      ['veggie:no-lettuce', selectionReferenceMap.get('Veggie Adjustments:No Lettuce')],
      ['veggie:no-tomato', selectionReferenceMap.get('Veggie Adjustments:No Tomato')],
      ['veggie:pickles', selectionReferenceMap.get('Veggie Adjustments:Extra Pickles')],
      ['addon:cheese', selectionReferenceMap.get('Add-ons:Add Cheese')],
      ['addon:bacon', selectionReferenceMap.get('Add-ons:Add Bacon')],
      ['ice:regular', selectionReferenceMap.get('Ice Level:Regular Ice')],
      ['ice:less', selectionReferenceMap.get('Ice Level:Less Ice')],
      ['ice:no', selectionReferenceMap.get('Ice Level:No Ice')],
      ['burger:spicy', selectionReferenceMap.get('Burger Choice:Spicy Chicken Burger')],
      ['burger:grilled', selectionReferenceMap.get('Burger Choice:Grilled Chicken Burger')],
      ['burger:beef', selectionReferenceMap.get('Burger Choice:Beef Bacon Burger')],
      ['snack:fries', selectionReferenceMap.get('Snack Choice:Golden Fries Medium')],
      ['snack:chicken', selectionReferenceMap.get('Snack Choice:Popcorn Chicken Small')],
      ['drink:cola', selectionReferenceMap.get('Drink Choice:Cola Medium')],
      ['drink:fruit', selectionReferenceMap.get('Drink Choice:Fruit Drink Medium')],
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
