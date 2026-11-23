import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
/** Creation paths must serialize with lifecycle changes, in the same material order as stock writers. */
export async function lockActiveMaterials(tx: Prisma.TransactionClient, storeId: string, ids: string[], error: string, inactiveError = error) {
  for (const id of [...new Set(ids)].sort((a, b) => a.localeCompare(b))) {
    const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM inventory_items WHERE id = ${id} AND storeId = ${storeId} AND isActive = true FOR UPDATE`);
    if (!locked.length) {
      if (inactiveError !== error && (await tx.inventoryItem.findUnique({ where: { id_storeId: { id, storeId } } }))?.isActive === false) throw new BadRequestException(inactiveError);
      throw new BadRequestException(error);
    }
  }
}
