import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
    return this.ordersService.getOrderDetail(id);
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

  @ApiOperation({ summary: 'Update order status' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body() body: UpdateOrderStatusDto) {
    return this.ordersService.updateOrderStatus(id, body);
  }

  @ApiOperation({ summary: 'Soft delete order' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Delete('orders/:id')
  deleteOrder(
    @Param('id') id: string,
    @Query('operatorName') operatorName?: string,
  ) {
    return this.ordersService.deleteOrder(id, operatorName);
  }
}
