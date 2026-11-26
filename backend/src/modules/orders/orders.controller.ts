import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';
import type { OrderScope } from './orders-query.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly merchantStores: MerchantStoreScope,
  ) {}

  private merchantOrderScope(user: AuthenticatedUser, storeId?: string): OrderScope {
    return {
      storeIds: this.merchantStores.forRequest(user, storeId),
      includeCustomerNickname: true,
      includeManualTransitions: true,
    };
  }

  @ApiOperation({ summary: 'Get order summary metrics' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Get('orders/summary')
  getOrderSummary(@Query() query: QueryOrdersDto) {
    return this.ordersService.getOrderSummary(query);
  }

  @ApiOperation({ summary: 'Get order list' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Get('orders')
  getOrders(@Query() query: QueryOrdersDto) {
    return this.ordersService.getOrders(query);
  }

  @ApiOperation({ summary: 'Get order detail' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Get('orders/:id')
  getOrderDetail(@Param('id') id: string) {
    return this.ordersService.getOrderDetail(id, { includeManualTransitions: true });
  }

  @ApiOperation({ summary: 'Get current customer order list' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Get('customer/orders')
  getCustomerOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOrdersDto) {
    return this.ordersService.getOrders(query, { customerUserId: user.userId });
  }

  @ApiOperation({ summary: 'Get current customer order detail' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Get('customer/orders/:id')
  getCustomerOrderDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getOrderDetail(id, { customerUserId: user.userId });
  }

  @ApiOperation({ summary: 'Get merchant order summary' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/orders/summary')
  getMerchantOrderSummary(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOrdersDto, @Headers('x-store-id') storeId?: string) {
    return this.ordersService.getOrderSummary(query, this.merchantOrderScope(user, storeId));
  }

  @ApiOperation({ summary: 'Get merchant order list' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/orders')
  getMerchantOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOrdersDto, @Headers('x-store-id') storeId?: string) {
    return this.ordersService.getOrders(query, this.merchantOrderScope(user, storeId));
  }

  @ApiOperation({ summary: 'Get merchant order detail' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/orders/:id')
  getMerchantOrderDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId?: string) {
    return this.ordersService.getOrderDetail(id, this.merchantOrderScope(user, storeId));
  }

  @ApiOperation({ summary: 'Update merchant order status' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Patch('merchant/orders/:id/status')
  updateMerchantOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-store-id') storeId?: string,
  ) {
    return this.ordersService.updateOrderStatus(
      id,
      { ...body, operatorName: user.userId },
      this.merchantOrderScope(user, storeId),
    );
  }

  @ApiOperation({ summary: 'Soft delete merchant order' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Delete('merchant/orders/:id')
  deleteMerchantOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-store-id') storeId?: string,
  ) {
    return this.ordersService.deleteOrder(id, user.userId, this.merchantOrderScope(user, storeId));
  }

  @ApiOperation({ summary: 'Create order using the legacy path' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Post('orders')
  createOrderCompat(
    @Body() body: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.createOrder(body, user.userId);
  }

  @ApiOperation({ summary: 'Create order' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Post('order/create')
  createOrder(
    @Body() body: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.createOrder(body, user.userId);
  }

  @ApiOperation({ summary: 'Create an order from the native customer app' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Post('mobile/orders')
  createMobileOrder(
    @Body() body: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.createOrder(body, user.userId, 'APP');
  }

  @ApiOperation({ summary: 'Update order status' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateOrderStatus(id, { ...body, operatorName: user.userId });
  }

  @ApiOperation({ summary: 'Soft delete order' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Delete('orders/:id')
  deleteOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.deleteOrder(id, user.userId);
  }
}
