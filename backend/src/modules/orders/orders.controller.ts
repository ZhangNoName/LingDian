import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Get order summary metrics' })
  @Get('orders/summary')
  getOrderSummary(@Query() query: QueryOrdersDto) {
    return this.ordersService.getOrderSummary(query);
  }

  @ApiOperation({ summary: 'Get order list' })
  @Get('orders')
  getOrders(@Query() query: QueryOrdersDto) {
    return this.ordersService.getOrders(query);
  }

  @ApiOperation({ summary: 'Get order detail' })
  @Get('orders/:id')
  getOrderDetail(@Param('id') id: string) {
    return this.ordersService.getOrderDetail(id);
  }

  @ApiOperation({ summary: 'Create order using the legacy path' })
  @Post('orders')
  createOrderCompat(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }

  @ApiOperation({ summary: 'Create order' })
  @Post('order/create')
  createOrder(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }

  @ApiOperation({ summary: 'Update order status' })
  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body() body: UpdateOrderStatusDto) {
    return this.ordersService.updateOrderStatus(id, body);
  }

  @ApiOperation({ summary: 'Soft delete order' })
  @Delete('orders/:id')
  deleteOrder(
    @Param('id') id: string,
    @Query('operatorName') operatorName?: string,
  ) {
    return this.ordersService.deleteOrder(id, operatorName);
  }
}
