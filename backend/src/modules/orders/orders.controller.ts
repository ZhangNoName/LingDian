import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: '兼容旧路径的下单接口' })
  @Post('orders')
  createOrderCompat(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }

  @ApiOperation({ summary: '创建订单并扣减库存' })
  @Post('order/create')
  createOrder(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }
}
