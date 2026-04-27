import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductType,
  SelectionGroupType,
  SelectionMode,
  SelectionOptionType,
  SelectionScope,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SyncProductConfigDto,
  SyncSelectionOptionDto,
} from './dto/sync-product-config.dto';
import { mapProductRecord } from './products.mapper';

const productInclude = {
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
        where: {
          isEnabled: true,
          group: {
            isActive: true,
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          group: {
            include: {
              options: {
                where: {
                  isActive: true,
                },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                include: {
                  referencedSku: {
                    select: {
                      id: true,
                      skuName: true,
                      product: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  selectionBindings: {
    where: {
      isEnabled: true,
      group: {
        isActive: true,
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      group: {
        include: {
          options: {
            where: {
              isActive: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              referencedSku: {
                select: {
                  id: true,
                  skuName: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    const products = await this.prisma.product.findMany({
      include: productInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return products.map(mapProductRecord);
  }

  async getProductDetail(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: productId,
      },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    return mapProductRecord(product);
  }

  async syncProductConfiguration(productId: string, payload: SyncProductConfigDto) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: productId,
      },
      include: {
        skus: true,
        selectionBindings: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    const productDetail = await this.prisma.$transaction(async (tx) => {
      if (payload.type) {
        await tx.product.update({
          where: { id: productId },
          data: { type: payload.type },
        });
      }

      const variantIdMap = await this.syncVariants(tx, productId, payload);
      await this.syncSelectionBindings(tx, product.storeId, productId, payload, variantIdMap);
      await this.refreshProductSummary(tx, productId);

      return tx.product.findUnique({
        where: { id: productId },
        include: productInclude,
      });
    });

    if (!productDetail) {
      throw new NotFoundException('商品不存在');
    }

    return mapProductRecord(productDetail);
  }

  async updateSkuStock(skuId: string, stockCount: number) {
    try {
      const sku = await this.prisma.productSKU.update({
        where: {
          id: skuId,
        },
        data: {
          stockCount,
        },
      });

      await this.refreshProductSummary(this.prisma, sku.productId);

      return {
        id: sku.id,
        stock_count: sku.stockCount,
      };
    } catch {
      throw new NotFoundException('SKU 不存在');
    }
  }

  async updateSkuPrice(skuId: string, price: number) {
    try {
      const sku = await this.prisma.productSKU.update({
        where: {
          id: skuId,
        },
        data: {
          price,
        },
      });

      await this.refreshProductSummary(this.prisma, sku.productId);

      return {
        id: sku.id,
        price: Number(sku.price),
      };
    } catch {
      throw new NotFoundException('SKU 不存在');
    }
  }

  private async syncVariants(
    tx: Prisma.TransactionClient,
    productId: string,
    payload: SyncProductConfigDto,
  ) {
    const existingVariants = await tx.productSKU.findMany({
      where: { productId },
    });
    const existingVariantMap = new Map(existingVariants.map((variant) => [variant.id, variant]));
    const activeVariantIds: string[] = [];
    const variantIdMap = new Map<string, string>();

    for (const [index, variant] of payload.variants.entries()) {
      let savedVariant;

      if (variant.id && existingVariantMap.has(variant.id)) {
        savedVariant = await tx.productSKU.update({
          where: { id: variant.id },
          data: {
            skuName: variant.sku_name,
            price: variant.price,
            stockCount: variant.stock_count,
            isDefault: variant.is_default ?? index === 0,
            isActive: variant.is_active ?? true,
          },
        });
      } else {
        savedVariant = await tx.productSKU.create({
          data: {
            productId,
            skuName: variant.sku_name,
            price: variant.price,
            stockCount: variant.stock_count,
            isDefault: variant.is_default ?? index === 0,
            isActive: variant.is_active ?? true,
          },
        });
      }

      if (variant.id) {
        variantIdMap.set(variant.id, savedVariant.id);
      }
      activeVariantIds.push(savedVariant.id);
    }

    await tx.productSKU.updateMany({
      where: {
        productId,
        id: {
          notIn: activeVariantIds,
        },
      },
      data: {
        isActive: false,
        isDefault: false,
      },
    });

    const defaultVariantId =
      payload.variants.find((variant) => variant.is_default)?.id ??
      activeVariantIds[0];

    if (defaultVariantId) {
      await tx.productSKU.updateMany({
        where: {
          productId,
        },
        data: {
          isDefault: false,
        },
      });

      await tx.productSKU.update({
        where: {
          id: variantIdMap.get(defaultVariantId) ?? defaultVariantId,
        },
        data: {
          isDefault: true,
        },
      });
    }

    return variantIdMap;
  }

  private async syncSelectionBindings(
    tx: Prisma.TransactionClient,
    storeId: string,
    productId: string,
    payload: SyncProductConfigDto,
    variantIdMap: Map<string, string>,
  ) {
    if (!payload.selection_groups) {
      return;
    }

    const existingBindings = await tx.productSelectionGroup.findMany({
      where: {
        OR: [
          { productId },
          {
            variant: {
              productId,
            },
          },
        ],
      },
      include: {
        group: {
          include: {
            options: true,
          },
        },
      },
    });
    const existingBindingMap = new Map(existingBindings.map((binding) => [binding.id, binding]));
    const existingGroupIds = new Set(existingBindings.map((binding) => binding.groupId));
    const activeBindingIds: string[] = [];

    for (const [index, binding] of payload.selection_groups.entries()) {
      const group = binding.group;
      let groupId = group.id;
      let savedGroup;

      if (groupId && existingGroupIds.has(groupId)) {
        savedGroup = await tx.selectionGroup.update({
          where: { id: groupId },
          data: {
            name: group.name,
            groupType: group.group_type ?? SelectionGroupType.MODIFIER,
            selectionMode: group.selection_mode ?? SelectionMode.SINGLE,
            minSelect: group.min_select ?? 0,
            maxSelect: group.max_select ?? 1,
            isRequired: group.is_required ?? false,
            isActive: group.is_active ?? true,
            sortOrder: group.sort_order ?? index,
            description: group.description,
          },
        });
      } else {
        savedGroup = await tx.selectionGroup.create({
          data: {
            storeId,
            name: group.name,
            groupType: group.group_type ?? SelectionGroupType.MODIFIER,
            selectionMode: group.selection_mode ?? SelectionMode.SINGLE,
            minSelect: group.min_select ?? 0,
            maxSelect: group.max_select ?? 1,
            isRequired: group.is_required ?? false,
            isActive: group.is_active ?? true,
            sortOrder: group.sort_order ?? index,
            description: group.description,
          },
        });
      }

      groupId = savedGroup.id;
      await this.syncSelectionOptions(tx, groupId, group.options, variantIdMap);

      const resolvedVariantId = binding.target_variant_id
        ? variantIdMap.get(binding.target_variant_id) ?? binding.target_variant_id
        : null;

      let savedBinding;
      if (binding.id && existingBindingMap.has(binding.id)) {
        savedBinding = await tx.productSelectionGroup.update({
          where: {
            id: binding.id,
          },
          data: {
            productId: binding.scope === SelectionScope.PRODUCT ? productId : null,
            variantId: binding.scope === SelectionScope.VARIANT ? resolvedVariantId : null,
            scope: binding.scope,
            sortOrder: binding.sort_order ?? index,
            isEnabled: binding.is_enabled ?? true,
            groupId,
          },
        });
      } else {
        savedBinding = await tx.productSelectionGroup.create({
          data: {
            productId: binding.scope === SelectionScope.PRODUCT ? productId : null,
            variantId: binding.scope === SelectionScope.VARIANT ? resolvedVariantId : null,
            scope: binding.scope,
            sortOrder: binding.sort_order ?? index,
            isEnabled: binding.is_enabled ?? true,
            groupId,
          },
        });
      }

      activeBindingIds.push(savedBinding.id);
    }

    const staleBindingIds = existingBindings
      .map((binding) => binding.id)
      .filter((bindingId) => !activeBindingIds.includes(bindingId));

    if (staleBindingIds.length > 0) {
      await tx.productSelectionGroup.updateMany({
        where: {
          id: {
            in: staleBindingIds,
          },
        },
        data: {
          isEnabled: false,
        },
      });
    }
  }

  private async syncSelectionOptions(
    tx: Prisma.TransactionClient,
    groupId: string,
    options: SyncSelectionOptionDto[],
    variantIdMap: Map<string, string>,
  ) {
    const existingOptions = await tx.selectionOption.findMany({
      where: {
        groupId,
      },
    });
    const existingOptionMap = new Map(existingOptions.map((option) => [option.id, option]));
    const activeOptionIds: string[] = [];

    for (const [index, option] of options.entries()) {
      const resolvedReferencedSkuId = option.referenced_sku_id
        ? variantIdMap.get(option.referenced_sku_id) ?? option.referenced_sku_id
        : null;

      let savedOption;

      if (option.id && existingOptionMap.has(option.id)) {
        savedOption = await tx.selectionOption.update({
          where: {
            id: option.id,
          },
          data: {
            name: option.name,
            optionType: option.option_type ?? SelectionOptionType.VALUE,
            priceDelta: option.price_delta ?? 0,
            stockDelta: option.stock_delta ?? 0,
            isDefault: option.is_default ?? false,
            isActive: option.is_active ?? true,
            sortOrder: option.sort_order ?? index,
            referencedSkuId: resolvedReferencedSkuId,
          },
        });
      } else {
        savedOption = await tx.selectionOption.create({
          data: {
            groupId,
            name: option.name,
            optionType: option.option_type ?? SelectionOptionType.VALUE,
            priceDelta: option.price_delta ?? 0,
            stockDelta: option.stock_delta ?? 0,
            isDefault: option.is_default ?? false,
            isActive: option.is_active ?? true,
            sortOrder: option.sort_order ?? index,
            referencedSkuId: resolvedReferencedSkuId,
          },
        });
      }

      activeOptionIds.push(savedOption.id);
    }

    await tx.selectionOption.updateMany({
      where: {
        groupId,
        id: {
          notIn: activeOptionIds,
        },
      },
      data: {
        isActive: false,
        isDefault: false,
      },
    });
  }

  private async refreshProductSummary(
    tx: Prisma.TransactionClient | PrismaService,
    productId: string,
  ) {
    const activeSkus = await tx.productSKU.findMany({
      where: {
        productId,
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    const totalStock = activeSkus.reduce((sum, sku) => sum + sku.stockCount, 0);
    const basePrice = activeSkus[0] ? Number(activeSkus[0].price) : 0;

    await tx.product.update({
      where: {
        id: productId,
      },
      data: {
        stock: totalStock,
        price: basePrice,
      },
    });
  }
}
