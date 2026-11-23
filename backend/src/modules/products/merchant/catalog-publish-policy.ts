import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@lingdian/db';
import type { ProductStatus } from '@lingdian/contracts';
const groupInclude = {
  options: {
    where: { isActive: true },
    include: { referencedSku: { include: { product: { select: { id: true, storeId: true, status: true } } } } },
  },
} satisfies Prisma.SelectionGroupInclude;
const bindingInclude = {
  where: { isEnabled: true, group: { isActive: true } },
  include: { group: { include: groupInclude } },
} satisfies Prisma.Product$selectionBindingsArgs;
const include = {
  category: true,
  skus: {
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { selectionBindings: bindingInclude },
  },
  selectionBindings: bindingInclude,
} satisfies Prisma.ProductInclude;
export async function assertPublishable(tx: Prisma.TransactionClient, productId: string, storeId: string) {
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, include });
  if (product.storeId !== storeId) throw new BadRequestException('catalog.productUnavailable');
  if (!product.category.isVisible || product.category.storeId !== storeId)
    throw new BadRequestException('catalog.categoryHidden');
  if (!product.skus.length) throw new BadRequestException('catalog.noActiveVariant');
  const sku = product.skus[0];
  for (const binding of [...product.selectionBindings, ...sku.selectionBindings]) {
    const group = binding.group,
      min = Math.max(group.minSelect, group.isRequired ? 1 : 0);
    if (min > group.maxSelect || (group.selectionMode === 'SINGLE' && group.maxSelect > 1))
      throw new BadRequestException('catalog.choicesUnavailable');
    const usable = group.options.filter(
      (option) =>
        option.optionType === 'VALUE' ||
        (option.referencedSku?.isActive &&
          option.referencedSku.product.storeId === storeId &&
          (option.referencedSku.product.status === 'ACTIVE' || option.referencedSku.product.id === productId)),
    );
    if (usable.length < min) throw new BadRequestException('catalog.choicesUnavailable');
  }
}
export function assertStatusTransition(from: ProductStatus, to: ProductStatus) {
  const allowed: Record<ProductStatus, readonly ProductStatus[]> = {
    DRAFT: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    ACTIVE: ['ACTIVE', 'DRAFT', 'SOLD_OUT', 'ARCHIVED'],
    SOLD_OUT: ['SOLD_OUT', 'ACTIVE', 'DRAFT', 'ARCHIVED'],
    ARCHIVED: ['ARCHIVED', 'DRAFT'],
  };
  if (!allowed[from]?.includes(to)) throw new BadRequestException('catalog.transitionUnavailable');
}
