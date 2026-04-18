import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  @Post()
  createOrder(@Body() body: CreateOrderDto) {
    const totalAmount = body.items.reduce((sum, item) => sum + item.quantity * 10, 0);

    return {
      orderNo: `LD${Date.now()}`,
      status: 'pending_payment',
      storeId: body.storeId,
      orderType: body.orderType,
      totalAmount,
      payableAmount: totalAmount,
      customerName: body.customerName,
      items: body.items,
      couponCode: body.couponCode ?? null,
      createdAt: new Date().toISOString(),
    };
  }
}
