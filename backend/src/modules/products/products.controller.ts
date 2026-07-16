import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SyncProductConfigDto } from './dto/sync-product-config.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateSkuPriceDto } from './dto/update-sku-price.dto';
import { UpdateSkuStockDto } from './dto/update-sku-stock.dto';
import { ProductsService } from './products.service';

const productUploadDir = join(process.cwd(), 'uploads', 'products');
type UploadFile = { originalname: string; filename: string };
type StorageCallback = (error: Error | null, destination: string) => void;
const { diskStorage } = require('multer') as {
  diskStorage: (options: {
    destination: (
      request: unknown,
      file: UploadFile,
      callback: StorageCallback,
    ) => void;
    filename: (
      request: unknown,
      file: UploadFile,
      callback: StorageCallback,
    ) => void;
  }) => unknown;
};

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Get category list' })
  @Get('categories')
  getCategories() {
    return this.productsService.getCategories();
  }

  @ApiOperation({ summary: 'Create category' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Post('categories')
  createCategory(@Body() body: CreateCategoryDto) {
    return this.productsService.createCategory(body);
  }

  @ApiOperation({ summary: 'Update category' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.productsService.updateCategory(id, body);
  }

  @ApiOperation({ summary: 'Get product list with SKU configuration' })
  @Get('products')
  getProducts() {
    return this.productsService.getProducts();
  }

  @ApiOperation({ summary: 'Create product' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Post('products')
  createProduct(@Body() body: CreateProductDto) {
    return this.productsService.createProduct(body);
  }

  @ApiOperation({ summary: 'Get product detail' })
  @Get('products/:id')
  getProductDetail(@Param('id') id: string) {
    return this.productsService.getProductDetail(id);
  }

  @ApiOperation({ summary: 'Update product base information' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productsService.updateProduct(id, body);
  }

  @ApiOperation({ summary: 'Update product status' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Patch('products/:id/status')
  updateProductStatus(
    @Param('id') id: string,
    @Body() body: UpdateProductStatusDto,
  ) {
    return this.productsService.updateProductStatus(id, body.status);
  }

  @ApiOperation({ summary: 'Sync product variants and selection configuration' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Put('products/:id/config')
  syncProductConfiguration(
    @Param('id') id: string,
    @Body() body: SyncProductConfigDto,
  ) {
    return this.productsService.syncProductConfiguration(id, body);
  }

  @ApiOperation({ summary: 'Update SKU stock entry' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Post('sku/update-stock')
  updateSkuStock(@Body() body: UpdateSkuStockDto) {
    return this.productsService.updateSkuStock(String(body.sku_id), body.stock_count);
  }

  @ApiOperation({ summary: 'Update SKU price' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Post('sku/update-price')
  updateSkuPrice(@Body() body: UpdateSkuPriceDto) {
    return this.productsService.updateSkuPrice(String(body.sku_id), body.price);
  }

  @ApiOperation({ summary: 'Upload product image' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Post('uploads/product-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          mkdirSync(productUploadDir, { recursive: true });
          callback(null, productUploadDir);
        },
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname);
          const safeBaseName = file.originalname
            .replace(extension, '')
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .slice(0, 40);
          callback(null, `${Date.now()}-${safeBaseName}${extension}`);
        },
      }),
      limits: {
        fileSize: 3 * 1024 * 1024,
      },
    }),
  )
  uploadProductImage(@UploadedFile() file?: UploadFile) {
    return {
      url: file ? `/uploads/products/${file.filename}` : '',
    };
  }
}
