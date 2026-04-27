import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncProductConfigDto } from './dto/sync-product-config.dto';
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

  @ApiOperation({ summary: '获取单个商品的完整配置详情' })
  @Get('products/:id')
  getProductDetail(@Param('id') id: string) {
    return this.productsService.getProductDetail(id);
  }

  @ApiOperation({ summary: '同步商品规格与配置项结构' })
  @Put('products/:id/config')
  syncProductConfiguration(@Param('id') id: string, @Body() body: SyncProductConfigDto) {
    return this.productsService.syncProductConfiguration(id, body);
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
