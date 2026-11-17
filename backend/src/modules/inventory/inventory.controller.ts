import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { AdjustInventoryDto, CreateInventoryItemDto, InventoryHistoryQueryDto, InventoryQueryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, MerchantGuard)
@Controller('merchant/stores/:storeId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Query() query: InventoryQueryDto) {
    return this.inventory.list(user, storeId, query);
  }

  @Get('movements')
  history(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Query() query: InventoryHistoryQueryDto) {
    return this.inventory.history(user, storeId, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Body() body: CreateInventoryItemDto) {
    return this.inventory.create(user, storeId, body);
  }

  @Post(':itemId/movements')
  adjust(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string, @Body() body: AdjustInventoryDto) {
    return this.inventory.adjust(user, storeId, itemId, body);
  }
}
