import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  createOrderCompat(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }

  @Post('order/create')
  createOrder(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }
}
