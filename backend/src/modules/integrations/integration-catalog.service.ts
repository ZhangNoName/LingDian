import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { IntegrationCapabilityContract, IntegrationProvider } from '@lingdian/contracts';
import { INTEGRATION_PROVIDERS } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { SignedConnectorAdapter, type IntegrationAdapter } from './connector.adapter';
import { readConnectorSettings, type ConnectorSettings } from './integration.config';
import { StoreContextResolver } from '../stores/store-context.resolver';

@Injectable()
export class IntegrationCatalogService {
  private readonly settings = readConnectorSettings();
  private readonly adapters = new Map<IntegrationProvider, IntegrationAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreContextResolver,
  ) {
    for (const setting of this.settings) {
      if (this.isAvailable(setting)) {
        this.adapters.set(setting.provider, new SignedConnectorAdapter(setting));
      }
    }
  }

  adapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
    return this.adapters.get(provider);
  }

  enabledDeploymentProviders(): IntegrationProvider[] {
    return this.settings
      .filter((setting) => setting.deploymentEnabled && this.isAvailable(setting))
      .map((setting) => setting.provider);
  }

  async enabledProvidersForStore(storeId: string): Promise<IntegrationProvider[]> {
    storeId = this.stores.resolveRequestedStoreId(storeId);
    const allowed = new Set(this.enabledDeploymentProviders());
    if (allowed.size === 0) return [];
    const rows = await this.prisma.storeIntegration.findMany({
      where: { storeId, enabled: true, provider: { in: [...allowed] } },
      select: { provider: true },
    });
    return rows.map((row) => row.provider);
  }

  async list(storeId: string): Promise<IntegrationCapabilityContract[]> {
    storeId = this.stores.resolveRequestedStoreId(storeId);
    await this.assertStoreExists(storeId);
    const rows = await this.prisma.storeIntegration.findMany({ where: { storeId } });
    const enabledByStore = new Map(rows.map((row) => [row.provider, row.enabled]));

    return this.settings.map((setting) => {
      const available = this.isAvailable(setting) && setting.deploymentEnabled;
      return {
        provider: setting.provider,
        display_name: setting.displayName,
        category: setting.category,
        available,
        enabled: available && enabledByStore.get(setting.provider) === true,
        store_id: storeId,
        reason: this.unavailableReason(setting),
      };
    });
  }

  async setEnabled(storeId: string, providerValue: string, enabled: boolean) {
    storeId = this.stores.resolveRequestedStoreId(storeId);
    await this.assertStoreExists(storeId);
    const provider = this.parseProvider(providerValue);
    const setting = this.setting(provider);
    if (enabled && (!setting.deploymentEnabled || !this.isAvailable(setting))) {
      throw new BadRequestException(this.unavailableReason(setting) ?? 'Integration is unavailable');
    }
    await this.prisma.storeIntegration.upsert({
      where: { storeId_provider: { storeId, provider } },
      create: { storeId, provider, enabled },
      update: { enabled },
    });
    const capability = (await this.list(storeId)).find((item) => item.provider === provider);
    if (!capability) throw new BadRequestException('Unknown integration provider');
    return capability;
  }

  private async assertStoreExists(storeId: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Store not found');
  }

  private parseProvider(value: string): IntegrationProvider {
    if (!(INTEGRATION_PROVIDERS as readonly string[]).includes(value)) {
      throw new BadRequestException('Unknown integration provider');
    }
    return value as IntegrationProvider;
  }

  private setting(provider: IntegrationProvider): ConnectorSettings {
    const result = this.settings.find((item) => item.provider === provider);
    if (!result) throw new BadRequestException('Unknown integration provider');
    return result;
  }

  private isAvailable(setting: ConnectorSettings): boolean {
    return Boolean(setting.endpoint && setting.signingSecret);
  }

  private unavailableReason(setting: ConnectorSettings): string | null {
    if (!setting.deploymentEnabled) return '部署级开关未启用';
    if (!setting.endpoint || !setting.signingSecret) return '连接器地址或签名密钥未配置';
    return null;
  }
}
