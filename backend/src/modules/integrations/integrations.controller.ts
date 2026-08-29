import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { SetIntegrationEnabledDto } from './dto/set-integration-enabled.dto';
import { IntegrationCatalogService } from './integration-catalog.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';

@ApiTags('Integrations')
@UseGuards(AccessTokenGuard, MerchantGuard)
@Controller('merchant/stores/:storeId/integrations')
export class IntegrationsController {
  constructor(
    private readonly catalog: IntegrationCatalogService,
    private readonly storeScope: MerchantStoreScope,
  ) {}

  @ApiOperation({ summary: 'List optional integration capabilities for a merchant store' })
  @Get()
  list(@Param('storeId') storeId: string, @CurrentUser() user: AuthenticatedUser) {
    this.storeScope.assertIncludes(user, storeId);
    return this.catalog.list(storeId);
  }

  @ApiOperation({ summary: 'Enable or disable one optional integration for a merchant store' })
  @Patch(':provider')
  setEnabled(
    @Param('storeId') storeId: string,
    @Param('provider') provider: string,
    @Body() body: SetIntegrationEnabledDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.storeScope.assertIncludes(user, storeId);
    return this.catalog.setEnabled(storeId, provider, body.enabled);
  }
}
