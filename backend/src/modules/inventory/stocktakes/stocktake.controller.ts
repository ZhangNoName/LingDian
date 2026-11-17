import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../../common/auth/access-token.guard';
import { MerchantGuard } from '../../../common/auth/merchant.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { StocktakeService } from './stocktake.service';
import { CreateStocktakeDto, SaveStocktakeDto, StocktakeQueryDto, StocktakeVersionDto } from './stocktake.dto';
@ApiTags('Stocktakes')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, MerchantGuard)
@Controller('merchant/stores/:storeId/inventory/stocktakes')
export class StocktakeController {
  constructor(private readonly stocktakes: StocktakeService) {}
  @Get('') list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Query() body: StocktakeQueryDto,
  ) {
    return this.stocktakes.list(user, store, body);
  }
  @Post('') create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Body() body: CreateStocktakeDto,
  ) {
    return this.stocktakes.create(user, store, body);
  }
  @Get(':id') detail(@CurrentUser() user: AuthenticatedUser, @Param('storeId') store: string, @Param('id') id: string) {
    return this.stocktakes.detail(user, store, id);
  }
  @Put(':id/counts') save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: SaveStocktakeDto,
  ) {
    return this.stocktakes.save(user, store, id, body);
  }
  @Post(':id/recount') refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: StocktakeVersionDto,
  ) {
    return this.stocktakes.refresh(user, store, id, body);
  }
  @Post(':id/post') post(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: StocktakeVersionDto,
  ) {
    return this.stocktakes.post(user, store, id, body);
  }
  @Post(':id/cancel') cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: StocktakeVersionDto,
  ) {
    return this.stocktakes.cancel(user, store, id, body);
  }
}
