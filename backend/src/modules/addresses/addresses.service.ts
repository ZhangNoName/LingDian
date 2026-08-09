import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserAddressRequest, UserAddress } from '@lingdian/contracts';
import { Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_ADDRESSES_PER_USER = 20;
const TRANSACTION_MAX_ATTEMPTS = 3;

type AddressRecord = {
  id: string;
  recipientName: string;
  phoneNumber: string;
  provinceName: string;
  cityName: string;
  countyName: string;
  streetName: string;
  detailInfo: string;
  postalCode: string;
  nationalCode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<UserAddress[]> {
    const rows = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map(toContract);
  }

  async create(userId: string, input: CreateUserAddressRequest): Promise<UserAddress> {
    const normalized = normalizeAddress(input);
    return this.transactionWithRetry(async (tx) => {
      const existing = await tx.userAddress.findFirst({ where: { userId, ...normalized } });
      if (existing) return toContract(existing);

      const total = await tx.userAddress.count({ where: { userId } });
      if (total >= MAX_ADDRESSES_PER_USER) {
        throw new BadRequestException('A user can save at most 20 addresses.');
      }
      const defaultCount = await tx.userAddress.count({ where: { userId, isDefault: true } });
      const created = await tx.userAddress.create({
        data: { userId, ...normalized, isDefault: defaultCount === 0 },
      });
      return toContract(created);
    });
  }

  async setDefault(userId: string, addressId: string): Promise<UserAddress> {
    return this.transactionWithRetry(async (tx) => {
      const owned = await tx.userAddress.findFirst({ where: { id: addressId, userId } });
      if (!owned) throw new NotFoundException('Address not found.');
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true, NOT: { id: addressId } },
        data: { isDefault: false },
      });
      const updated = await tx.userAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
      return toContract(updated);
    });
  }

  async remove(userId: string, addressId: string): Promise<void> {
    await this.transactionWithRetry(async (tx) => {
      const owned = await tx.userAddress.findFirst({ where: { id: addressId, userId } });
      if (!owned) throw new NotFoundException('Address not found.');
      await tx.userAddress.delete({ where: { id: owned.id } });
      if (!owned.isDefault) return;

      const replacement = await tx.userAddress.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      if (replacement) {
        await tx.userAddress.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
      }
    });
  }

  async findOwnedAddress(userId: string, addressId: string): Promise<UserAddress> {
    const address = await this.prisma.userAddress.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found.');
    return toContract(address);
  }

  private async transactionWithRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < TRANSACTION_MAX_ATTEMPTS) continue;
        throw error;
      }
    }
    throw new Error('Address transaction retry limit reached.');
  }
}

function normalizeAddress(input: CreateUserAddressRequest): CreateUserAddressRequest {
  return {
    recipientName: input.recipientName.trim(),
    phoneNumber: input.phoneNumber.trim(),
    provinceName: input.provinceName.trim(),
    cityName: input.cityName.trim(),
    countyName: input.countyName.trim(),
    streetName: input.streetName.trim(),
    detailInfo: input.detailInfo.trim(),
    postalCode: input.postalCode.trim(),
    nationalCode: input.nationalCode.trim(),
  };
}

function toContract(row: AddressRecord): UserAddress {
  return {
    id: row.id,
    recipientName: row.recipientName,
    phoneNumber: row.phoneNumber,
    provinceName: row.provinceName,
    cityName: row.cityName,
    countyName: row.countyName,
    streetName: row.streetName,
    detailInfo: row.detailInfo,
    postalCode: row.postalCode,
    nationalCode: row.nationalCode,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    ((error as { code?: unknown }).code === 'P2034' || (error as { code?: unknown }).code === 'P2002');
}
