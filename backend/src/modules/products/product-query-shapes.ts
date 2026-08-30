import { Prisma } from '@lingdian/db';

const REFERENCED_SKU_INCLUDE = {
  select: {
    id: true,
    skuName: true,
    product: { select: { id: true, name: true } },
  },
} as const;

export const PRODUCT_MANAGEMENT_INCLUDE = {
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  skus: {
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: {
      selectionBindings: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          group: {
            include: {
              options: {
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                include: {
                  referencedSku: REFERENCED_SKU_INCLUDE,
                },
              },
            },
          },
        },
      },
    },
  },
  selectionBindings: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      group: {
        include: {
          options: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              referencedSku: REFERENCED_SKU_INCLUDE,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export const PRODUCT_MENU_INCLUDE = {
  category: PRODUCT_MANAGEMENT_INCLUDE.category,
  skus: {
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: {
      selectionBindings: {
        where: { isEnabled: true, group: { isActive: true } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          group: {
            include: {
              options: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                include: { referencedSku: REFERENCED_SKU_INCLUDE },
              },
            },
          },
        },
      },
    },
  },
  selectionBindings: {
    where: { isEnabled: true, group: { isActive: true } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      group: {
        include: {
          options: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: { referencedSku: REFERENCED_SKU_INCLUDE },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export const PRODUCT_LIST_SELECT = {
  id: true,
  storeId: true,
  categoryId: true,
  name: true,
  description: true,
  imageUrl: true,
  type: true,
  status: true,
  price: true,
  stock: true,
  isFeatured: true,
  category: { select: { name: true } },
  skus: {
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      productId: true,
      skuName: true,
      price: true,
      stockCount: true,
      isDefault: true,
      isActive: true,
      _count: { select: { selectionBindings: { where: { isEnabled: true } } } },
    },
  },
  _count: { select: { selectionBindings: { where: { isEnabled: true } } } },
} satisfies Prisma.ProductSelect;
