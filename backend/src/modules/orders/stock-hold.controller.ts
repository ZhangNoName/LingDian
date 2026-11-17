import { Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { StockHoldService } from './stock-hold.service';
import { StockHoldPageDto, StockHoldQueryDto } from './dto/stock-hold.dto';
@ApiTags('Inventory holds')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, MerchantGuard)
@Controller('merchant/stock-holds')
export class StockHoldController {
  constructor(private readonly holds: StockHoldService) {}
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId: string | undefined, @Query() query: StockHoldQueryDto) { return this.holds.list(user, storeId, query); }
  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId: string | undefined, @Param('id') id: string, @Query() query: StockHoldPageDto) { return this.holds.detail(user, storeId, id, query); }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(':id/recheck')
  recheck(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId: string | undefined, @Param('id') id: string) { return this.holds.recheck(user, storeId, id); }
}
