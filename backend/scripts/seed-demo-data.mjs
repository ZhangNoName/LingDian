import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  PrismaClient,
  ProductStatus,
  ProductType,
  SelectionGroupType,
  SelectionMode,
  SelectionOptionType,
  SelectionScope,
  StoreStatus,
} from '@prisma/client';

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

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.orderItemSelection.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.order.deleteMany();
    await tx.productSelectionGroup.deleteMany();
    await tx.selectionOption.deleteMany();
    await tx.selectionGroup.deleteMany();
    await tx.productSKU.deleteMany();
    await tx.product.deleteMany();
    await tx.category.deleteMany();
    await tx.store.deleteMany();

    const store = await tx.store.create({
      data: storeSeed,
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
  });

  const [stores, categories, products, skus, groups, options, bindings] = await Promise.all([
    prisma.store.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productSKU.count(),
    prisma.selectionGroup.count(),
    prisma.selectionOption.count(),
    prisma.productSelectionGroup.count(),
  ]);

  console.log(
    `Demo seed complete: ${stores} store(s), ${categories} categories, ${products} products, ${skus} skus, ${groups} groups, ${options} options, ${bindings} bindings.`,
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
