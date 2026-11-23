import { StoreContextQueryDto } from '../stores/dto/store-context.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { orderPaymentRequired } from '../../config/order-payment';

@Controller('menu')
export class MenuController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('current')
  async getCurrentMenu(@Query() query: StoreContextQueryDto = {}) {
    const menu = await this.productsService.getCurrentMenu(query.storeId);
    return { ...menu, paymentRequired: orderPaymentRequired() };
  }
}

