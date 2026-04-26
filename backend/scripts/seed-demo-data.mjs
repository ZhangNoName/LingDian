import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient, ProductStatus, StoreStatus } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseUrl),
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
    name: '人气汉堡',
    sortOrder: 1,
    products: [
      {
        name: '香辣脆鸡腿堡',
        description: '整块脆鸡腿排搭配生菜与微辣酱汁，适合午晚餐主食。',
        imageUrl: 'https://example.com/demo/spicy-chicken-burger.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { skuName: '单品', price: 19.9, stockCount: 120 },
          { skuName: '双层加肉', price: 27.9, stockCount: 60 },
        ],
      },
      {
        name: '经典香烤鸡腿堡',
        description: '香烤鸡腿排搭配番茄与黑胡椒酱，口味更柔和。',
        imageUrl: 'https://example.com/demo/grilled-chicken-burger.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { skuName: '单品', price: 21.9, stockCount: 96 },
          { skuName: '芝士升级', price: 24.9, stockCount: 72 },
        ],
      },
      {
        name: '牛肉培根芝士堡',
        description: '牛肉饼、培根与芝士叠层，适合高满足感用户。',
        imageUrl: 'https://example.com/demo/beef-bacon-burger.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { skuName: '单品', price: 28.9, stockCount: 48 },
        ],
      },
    ],
  },
  {
    name: '小食炸物',
    sortOrder: 2,
    products: [
      {
        name: '黄金薯条',
        description: '现炸细薯条，外脆内软，适合搭配主餐。',
        imageUrl: 'https://example.com/demo/fries.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { skuName: '中份', price: 11.9, stockCount: 180 },
          { skuName: '大份', price: 15.9, stockCount: 120 },
        ],
      },
      {
        name: '吮指原味鸡块',
        description: '经典炸鸡块，适合多人加购分享。',
        imageUrl: 'https://example.com/demo/fried-chicken.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { skuName: '2 块', price: 14.9, stockCount: 90 },
          { skuName: '4 块', price: 27.9, stockCount: 45 },
        ],
      },
      {
        name: '香辣鸡米花',
        description: '小块鸡肉裹粉现炸，带一点轻微辣感。',
        imageUrl: 'https://example.com/demo/popcorn-chicken.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { skuName: '小份', price: 13.9, stockCount: 88 },
          { skuName: '分享装', price: 22.9, stockCount: 40 },
        ],
      },
    ],
  },
  {
    name: '卷饼与饭食',
    sortOrder: 3,
    products: [
      {
        name: '老北京鸡肉卷',
        description: '薄饼卷入鸡柳、生菜与甜面酱风味酱汁。',
        imageUrl: 'https://example.com/demo/chicken-wrap.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { skuName: '经典卷', price: 18.9, stockCount: 76 },
          { skuName: '双卷套餐主食', price: 32.9, stockCount: 24 },
        ],
      },
      {
        name: '照烧鸡腿饭',
        description: '照烧鸡腿肉配时蔬和米饭，适合正餐场景。',
        imageUrl: 'https://example.com/demo/teriyaki-rice.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { skuName: '标准份', price: 26.9, stockCount: 54 },
        ],
      },
    ],
  },
  {
    name: '饮品甜点',
    sortOrder: 4,
    products: [
      {
        name: '百事可乐',
        description: '经典碳酸饮料，冰爽解腻。',
        imageUrl: 'https://example.com/demo/cola.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { skuName: '中杯', price: 8.5, stockCount: 150 },
          { skuName: '大杯', price: 10.5, stockCount: 110 },
        ],
      },
      {
        name: '九珍果汁饮',
        description: '复合果味饮品，偏甜口，适合套餐搭配。',
        imageUrl: 'https://example.com/demo/fruit-drink.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        skus: [
          { skuName: '中杯', price: 10.9, stockCount: 90 },
        ],
      },
      {
        name: '葡式蛋挞',
        description: '酥皮层次分明，内馅香甜。',
        imageUrl: 'https://example.com/demo/egg-tart.jpg',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        skus: [
          { skuName: '1 只', price: 7.5, stockCount: 70 },
          { skuName: '2 只', price: 13.9, stockCount: 35 },
        ],
      },
    ],
  },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany();
    await tx.order.deleteMany();
    await tx.productSKU.deleteMany();
    await tx.product.deleteMany();
    await tx.category.deleteMany();
    await tx.store.deleteMany();

    const store = await tx.store.create({
      data: storeSeed,
    });

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

        await tx.product.create({
          data: {
            storeId: store.id,
            categoryId: category.id,
            name: productSeed.name,
            description: productSeed.description,
            imageUrl: productSeed.imageUrl,
            price: basePrice,
            status: productSeed.status,
            isFeatured: productSeed.isFeatured,
            stock,
            skus: {
              create: productSeed.skus.map((sku) => ({
                skuName: sku.skuName,
                price: sku.price,
                stockCount: sku.stockCount,
              })),
            },
          },
        });
      }
    }
  });

  const [stores, categories, products, skus] = await Promise.all([
    prisma.store.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productSKU.count(),
  ]);

  console.log(
    `Demo seed complete: ${stores} store(s), ${categories} categories, ${products} products, ${skus} skus.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
