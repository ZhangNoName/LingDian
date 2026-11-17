import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';

type StoreClient = PrismaService | Prisma.TransactionClient;
type StoreRecord = Prisma.StoreGetPayload<Prisma.StoreDefaultArgs>;
export type StoreMode = 'single' | 'multi';

/**
 * The boundary between business code and the current store-selection policy.
 * Single and multi-store deployments share contracts and persisted store boundaries.
 */
export abstract class StoreContextResolver {
  abstract readonly mode: StoreMode;
  abstract primaryStoreId(): string;
  abstract resolveRequestedStoreId(requestedStoreId?: string): string;
  abstract resolveStoreIds(requestedStoreIds?: readonly string[]): string[];
  abstract resolveCurrentStore(client?: StoreClient, requestedStoreId?: string): Promise<StoreRecord>;
  abstract assertReady(): Promise<void>;
}

@Injectable()
export class SingleStoreContextResolver
  extends StoreContextResolver
  implements OnApplicationBootstrap
{
  readonly mode: StoreMode = 'single';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  primaryStoreId(): string {
    const storeId = this.config.get<string>('store.primaryStoreId')?.trim();
    if (!storeId) {
      throw new ServiceUnavailableException('Service is not ready');
    }
    return storeId;
  }

  resolveRequestedStoreId(requestedStoreId?: string): string {
    const primaryStoreId = this.primaryStoreId();
    if (requestedStoreId === undefined) return primaryStoreId;
    if (requestedStoreId.trim() !== primaryStoreId) {
      throw new BadRequestException('The requested store does not match the configured store');
    }
    return primaryStoreId;
  }

  resolveStoreIds(requestedStoreIds?: readonly string[]): string[] {
    const primaryStoreId = this.primaryStoreId();
    if (requestedStoreIds === undefined) return [primaryStoreId];

    const normalized = [...new Set(requestedStoreIds
      .map((storeId) => storeId.trim())
      .filter(Boolean))];
    if (normalized.length !== 1 || normalized[0] !== primaryStoreId) {
      throw new ForbiddenException('Store access is outside the configured store');
    }
    return [primaryStoreId];
  }

  async resolveCurrentStore(client: StoreClient = this.prisma, requestedStoreId?: string): Promise<StoreRecord> {
    const store = await client.store.findUnique({
      where: { id: this.resolveRequestedStoreId(requestedStoreId) },
    });
    if (!store) {
      throw new ServiceUnavailableException('Service is not ready');
    }
    return store;
  }

  async assertReady(): Promise<void> {
    try {
      await this.resolveCurrentStore();
    } catch {
      throw new ServiceUnavailableException('Service is not ready');
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.assertReady();
  }
}

/** Store authorization remains the caller's responsibility; this resolver never grants access. */
@Injectable()
export class MultiStoreContextResolver extends SingleStoreContextResolver {
  readonly mode: StoreMode = 'multi';

  resolveRequestedStoreId(requestedStoreId?: string): string {
    if (requestedStoreId === undefined) return this.primaryStoreId();
    if (!requestedStoreId.trim() || requestedStoreId !== requestedStoreId.trim() || requestedStoreId.length > 191 || requestedStoreId.includes(',')) {
      throw new BadRequestException('Invalid store id');
    }
    return requestedStoreId;
  }

  resolveStoreIds(requestedStoreIds?: readonly string[]): string[] {
    if (requestedStoreIds === undefined) return [this.primaryStoreId()];
    if (requestedStoreIds.length === 0 || requestedStoreIds.length > 100) {
      throw new ForbiddenException('A non-empty store scope is required');
    }
    return [...new Set(requestedStoreIds.map((id) => this.resolveRequestedStoreId(id)))].sort();
  }
}
