import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateSkuPriceDto } from './dto/update-sku-price.dto';
import { UpdateSkuStockDto } from './dto/update-sku-stock.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: '获取商品列表及其所有 SKU' })
  @Get('products')
  getProducts() {
    return this.productsService.getProducts();
  }

  @ApiOperation({ summary: '更新 SKU 库存' })
  @Post('sku/update-stock')
  updateSkuStock(@Body() body: UpdateSkuStockDto) {
    return this.productsService.updateSkuStock(String(body.sku_id), body.stock_count);
  }

  @ApiOperation({ summary: '更新 SKU 售价' })
  @Post('sku/update-price')
  updateSkuPrice(@Body() body: UpdateSkuPriceDto) {
    return this.productsService.updateSkuPrice(String(body.sku_id), body.price);
  }
}
