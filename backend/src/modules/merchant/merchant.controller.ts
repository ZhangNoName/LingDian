import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { MerchantDashboardService } from './merchant-dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { MerchantService } from './merchant.service';

@ApiTags('Merchant')
@ApiBearerAuth()
@Controller('merchant')
@UseGuards(AccessTokenGuard, MerchantGuard)
export class MerchantController {
  constructor(private readonly merchants: MerchantService, private readonly dashboard: MerchantDashboardService) {}

  @Get('dashboard')
  snapshot(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId: string | undefined, @Query() query: DashboardQueryDto) {
    return this.dashboard.snapshot(user, storeId, query);
  }

  @ApiOperation({ summary: 'List stores authorized by the merchant session' })
  @Get('stores')
  listStores(@CurrentUser() user: AuthenticatedUser) {
    return this.merchants.listStores(user);
  }
}
