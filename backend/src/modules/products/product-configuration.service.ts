import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  SelectionGroupType,
  SelectionMode,
  SelectionOptionType,
  SelectionScope,
} from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SyncProductConfigDto,
  SyncSelectionOptionDto,
} from './dto/sync-product-config.dto';

type ProductWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ProductConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(
    productId: string,
    storeId: string,
    payload: SyncProductConfigDto,
  ): Promise<void> {
    this.validateSelectionConfiguration(payload);

    await this.prisma.$transaction(async (tx) => {
      if (payload.type) {
        await tx.product.update({
          where: { id: productId },
          data: { type: payload.type },
        });
      }

      const variantIdMap = await this.syncVariants(tx, productId, payload);
      await this.syncSelectionBindings(tx, storeId, productId, payload, variantIdMap);
      await this.refreshProductSummary(tx, productId);
    });
  }

  async refreshProductSummary(tx: ProductWriteClient, productId: string) {
    const activeSkus = await tx.productSKU.findMany({
      where: { productId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    const totalStock = activeSkus.reduce((sum, sku) => sum + sku.stockCount, 0);
    const basePrice = activeSkus[0] ? Number(activeSkus[0].price) : 0;

    await tx.product.update({
      where: { id: productId },
      data: { stock: totalStock, price: basePrice },
    });
  }

  private async syncVariants(
    tx: Prisma.TransactionClient,
    productId: string,
    payload: SyncProductConfigDto,
  ) {
    const existingVariants = await tx.productSKU.findMany({ where: { productId } });
    const existingVariantMap = new Map(existingVariants.map((variant) => [variant.id, variant]));
    const activeVariantIds: string[] = [];
    const variantIdMap = new Map<string, string>();
    let requestedDefaultVariantId: string | undefined;

    for (const [index, variant] of payload.variants.entries()) {
      const savedVariant = variant.id && existingVariantMap.has(variant.id)
        ? await tx.productSKU.update({
            where: { id: variant.id },
            data: {
              skuName: variant.sku_name,
              price: variant.price,
              stockCount: variant.stock_count,
              isDefault: variant.is_default ?? index === 0,
              isActive: variant.is_active ?? true,
            },
          })
        : await tx.productSKU.create({
            data: {
              productId,
              skuName: variant.sku_name,
              price: variant.price,
              stockCount: variant.stock_count,
              isDefault: variant.is_default ?? index === 0,
              isActive: variant.is_active ?? true,
            },
          });

      if (variant.id) variantIdMap.set(variant.id, savedVariant.id);
      if (variant.is_default) requestedDefaultVariantId = savedVariant.id;
      activeVariantIds.push(savedVariant.id);
    }

    await tx.productSKU.updateMany({
      where: { productId, id: { notIn: activeVariantIds } },
      data: { isActive: false, isDefault: false },
    });

    const defaultVariantId = requestedDefaultVariantId ?? activeVariantIds[0];
    if (defaultVariantId) {
      await tx.productSKU.updateMany({ where: { productId }, data: { isDefault: false } });
      await tx.productSKU.update({
        where: { id: defaultVariantId },
        data: { isDefault: true },
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
    if (!payload.selection_groups) return;

    const existingBindings = await tx.productSelectionGroup.findMany({
      where: {
        OR: [{ productId }, { variant: { productId } }],
      },
      include: { group: { include: { options: true } } },
    });
    const existingBindingMap = new Map(existingBindings.map((binding) => [binding.id, binding]));
    const existingGroupIds = new Set(existingBindings.map((binding) => binding.groupId));
    const activeBindingIds: string[] = [];

    for (const [index, binding] of payload.selection_groups.entries()) {
      const group = binding.group;
      const savedGroup = group.id && existingGroupIds.has(group.id)
        ? await tx.selectionGroup.update({
            where: { id: group.id },
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
          })
        : await tx.selectionGroup.create({
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

      await this.syncSelectionOptions(
        tx,
        storeId,
        savedGroup.id,
        group.options,
        variantIdMap,
      );

      const resolvedVariantId = binding.target_variant_id
        ? variantIdMap.get(binding.target_variant_id)
        : null;
      if (binding.scope === SelectionScope.VARIANT && !resolvedVariantId) {
        throw new BadRequestException('选择组绑定的 SKU 不属于当前商品');
      }

      const savedBinding = binding.id && existingBindingMap.has(binding.id)
        ? await tx.productSelectionGroup.update({
            where: { id: binding.id },
            data: {
              productId: binding.scope === SelectionScope.PRODUCT ? productId : null,
              variantId: binding.scope === SelectionScope.VARIANT ? resolvedVariantId : null,
              scope: binding.scope,
              sortOrder: binding.sort_order ?? index,
              isEnabled: binding.is_enabled ?? true,
              groupId: savedGroup.id,
            },
          })
        : await tx.productSelectionGroup.create({
            data: {
              productId: binding.scope === SelectionScope.PRODUCT ? productId : null,
              variantId: binding.scope === SelectionScope.VARIANT ? resolvedVariantId : null,
              scope: binding.scope,
              sortOrder: binding.sort_order ?? index,
              isEnabled: binding.is_enabled ?? true,
              groupId: savedGroup.id,
            },
          });

      activeBindingIds.push(savedBinding.id);
    }

    const staleBindingIds = existingBindings
      .map((binding) => binding.id)
      .filter((bindingId) => !activeBindingIds.includes(bindingId));
    if (staleBindingIds.length > 0) {
      await tx.productSelectionGroup.updateMany({
        where: { id: { in: staleBindingIds } },
        data: { isEnabled: false },
      });
    }
  }

  private async syncSelectionOptions(
    tx: Prisma.TransactionClient,
    storeId: string,
    groupId: string,
    options: SyncSelectionOptionDto[],
    variantIdMap: Map<string, string>,
  ) {
    const existingOptions = await tx.selectionOption.findMany({ where: { groupId } });
    const existingOptionMap = new Map(existingOptions.map((option) => [option.id, option]));
    const activeOptionIds: string[] = [];
    const referencedSkuIds = [...new Set(
      options
        .map((option) => option.referenced_sku_id)
        .filter((skuId): skuId is string => Boolean(skuId))
        .map((skuId) => variantIdMap.get(skuId) ?? skuId),
    )];
    const referencedSkus = referencedSkuIds.length
      ? await tx.productSKU.findMany({
          where: { id: { in: referencedSkuIds }, product: { storeId } },
          select: { id: true },
        })
      : [];
    const allowedReferencedSkuIds = new Set(referencedSkus.map((sku) => sku.id));
    if (allowedReferencedSkuIds.size !== referencedSkuIds.length) {
      throw new BadRequestException('引用的 SKU 不属于当前门店');
    }

    for (const [index, option] of options.entries()) {
      const resolvedReferencedSkuId = option.referenced_sku_id
        ? variantIdMap.get(option.referenced_sku_id) ?? option.referenced_sku_id
        : null;
      const savedOption = option.id && existingOptionMap.has(option.id)
        ? await tx.selectionOption.update({
            where: { id: option.id },
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
          })
        : await tx.selectionOption.create({
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
      activeOptionIds.push(savedOption.id);
    }

    await tx.selectionOption.updateMany({
      where: { groupId, id: { notIn: activeOptionIds } },
      data: { isActive: false, isDefault: false },
    });
  }

  private validateSelectionConfiguration(payload: SyncProductConfigDto) {
    for (const binding of payload.selection_groups ?? []) {
      const group = binding.group;
      const minSelect = group.min_select ?? 0;
      const maxSelect = group.max_select ?? 1;
      if (minSelect > maxSelect) {
        throw new BadRequestException('选择组的最少选择数不能大于最多选择数');
      }
      if (group.selection_mode === SelectionMode.SINGLE && maxSelect > 1) {
        throw new BadRequestException('单选组的最多选择数必须为 1');
      }
      if (group.is_required && maxSelect < 1) {
        throw new BadRequestException('必选组必须允许至少选择一项');
      }
      if ((binding.is_enabled ?? true) && (group.is_active ?? true)) {
        const activeOptionCount = group.options.filter((option) => option.is_active ?? true).length;
        const requiredOptionCount = Math.max(minSelect, group.is_required ? 1 : 0);
        if (activeOptionCount < requiredOptionCount) {
          throw new BadRequestException('启用的选择组没有足够的可选项满足最少选择数');
        }
      }
      for (const option of group.options) {
        if (option.option_type === SelectionOptionType.VARIANT && !option.referenced_sku_id) {
          throw new BadRequestException('引用 SKU 的选项必须选择一个 SKU');
        }
      }
    }
  }
}
