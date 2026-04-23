import { Body, Controller, Get, Post } from '@nestjs/common';
import { UpdateSkuPriceDto } from './dto/update-sku-price.dto';
import { UpdateSkuStockDto } from './dto/update-sku-stock.dto';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  getProducts() {
    return this.productsService.getProducts();
  }

  @Post('sku/update-stock')
  updateSkuStock(@Body() body: UpdateSkuStockDto) {
    return this.productsService.updateSkuStock(String(body.sku_id), body.stock_count);
  }

  @Post('sku/update-price')
  updateSkuPrice(@Body() body: UpdateSkuPriceDto) {
    return this.productsService.updateSkuPrice(String(body.sku_id), body.price);
  }
}
