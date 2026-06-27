import { Controller, Get } from '@nestjs/common';
import { ProductsService } from '../products/products.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('current')
  getCurrentMenu() {
    return this.productsService.getCurrentMenu();
  }
}

