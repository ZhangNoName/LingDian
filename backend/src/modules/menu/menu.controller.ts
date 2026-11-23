import { StoreContextQueryDto } from '../stores/dto/store-context.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from '../products/products.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('current')
  getCurrentMenu(@Query() query: StoreContextQueryDto = {}) {
    return this.productsService.getCurrentMenu(query.storeId);
  }
}

