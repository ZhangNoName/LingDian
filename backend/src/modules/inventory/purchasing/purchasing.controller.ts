import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../../common/auth/access-token.guard';
import { MerchantGuard } from '../../../common/auth/merchant.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import {
  CancelPurchaseDto,
  CreatePurchaseDto,
  PurchasingQueryDto,
  ReceivePurchaseDto,
  SupplierDto,
  UpdateSupplierDto,
} from './purchasing.dto';
import { PurchasingService } from './purchasing.service';
import { SupplierService } from './supplier.service';
@ApiTags('Purchasing')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, MerchantGuard)
@Controller('merchant/stores/:storeId/inventory')
export class PurchasingController {
  constructor(
    private readonly purchasing: PurchasingService,
    private readonly suppliers: SupplierService,
  ) {}
  @Get('suppliers') listSuppliers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: PurchasingQueryDto,
  ) {
    return this.suppliers.list(user, storeId, query);
  }
  @Post('suppliers') createSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() body: SupplierDto,
  ) {
    return this.suppliers.save(user, storeId, body);
  }
  @Put('suppliers/:id') updateSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
  ) {
    return this.suppliers.save(user, storeId, body, id);
  }
  @Get('purchases') list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: PurchasingQueryDto,
  ) {
    return this.purchasing.list(user, storeId, query);
  }
  @Post('purchases') create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() body: CreatePurchaseDto,
  ) {
    return this.purchasing.create(user, storeId, body);
  }
  @Get('purchases/:id') detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
  ) {
    return this.purchasing.detail(user, storeId, id);
  }
  @Get('purchases/:id/receipts') receipts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Query() query: PurchasingQueryDto,
  ) {
    return this.purchasing.receipts(user, storeId, id, query);
  }
  @Post('purchases/:id/receipts') receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: ReceivePurchaseDto,
  ) {
    return this.purchasing.receive(user, storeId, id, body);
  }
  @Post('purchases/:id/cancel') cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: CancelPurchaseDto,
  ) {
    return this.purchasing.cancel(user, storeId, id, body);
  }
}
