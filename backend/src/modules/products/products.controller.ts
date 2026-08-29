import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { mkdirSync } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { SyncProductConfigDto } from './dto/sync-product-config.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateSkuPriceDto } from './dto/update-sku-price.dto';
import { UpdateSkuStockDto } from './dto/update-sku-stock.dto';
import { optimizeProductImage } from './product-image-optimizer';
import { ProductsService } from './products.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';

const productUploadDir = join(process.cwd(), 'uploads', 'products');
type UploadFile = { originalname: string; filename: string; mimetype: string; path: string };
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
    fileFilter?: (
      request: unknown,
      file: UploadFile,
      callback: (error: Error | null, accept: boolean) => void,
    ) => void;
  }) => unknown;
};

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly merchantStores: MerchantStoreScope,
  ) {}

  @ApiOperation({ summary: 'Get category list' })
  @UseGuards(AccessTokenGuard, AdminGuard)
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
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Get('products')
  getProducts(@Query() query: QueryProductsDto) {
    return this.productsService.getProducts(query);
  }

  @ApiOperation({ summary: 'Create product' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Post('products')
  createProduct(@Body() body: CreateProductDto) {
    return this.productsService.createProduct(body);
  }

  @ApiOperation({ summary: 'Get product detail' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Get('products/:id')
  getProductDetail(@Param('id') id: string) {
    return this.productsService.getProductDetail(id);
  }

  @ApiOperation({ summary: 'Get merchant product list' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/products')
  getMerchantProducts(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryProductsDto) {
    return this.productsService.getProducts(query, this.merchantStores.storeIds(user));
  }

  @ApiOperation({ summary: 'Get merchant product summary metrics' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/products/stats')
  getMerchantProductStats(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.getProductStats(this.merchantStores.storeIds(user));
  }

  @ApiOperation({ summary: 'Get lightweight merchant SKU reference options' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/products/sku-options')
  getMerchantProductSkuOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.getProductSkuOptions(this.merchantStores.storeIds(user));
  }

  @ApiOperation({ summary: 'Get merchant product detail' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/products/:id')
  getMerchantProductDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.getProductDetail(id, this.merchantStores.storeIds(user));
  }

  @ApiOperation({ summary: 'Sync merchant product configuration' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Put('merchant/products/:id/config')
  syncMerchantProductConfiguration(
    @Param('id') id: string,
    @Body() body: SyncProductConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.syncProductConfiguration(id, body, this.merchantStores.storeIds(user));
  }

  @ApiOperation({ summary: 'Update merchant SKU stock' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Post('merchant/sku/update-stock')
  updateMerchantSkuStock(@Body() body: UpdateSkuStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.updateSkuStock(String(body.sku_id), body.stock_count, this.merchantStores.storeIds(user));
  }

  @ApiOperation({ summary: 'Update merchant SKU price' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Post('merchant/sku/update-price')
  updateMerchantSkuPrice(@Body() body: UpdateSkuPriceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.updateSkuPrice(String(body.sku_id), body.price, this.merchantStores.storeIds(user));
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
          const extension = imageExtension(file.mimetype);
          const safeBaseName = file.originalname
            .replace(extname(file.originalname), '')
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .slice(0, 40);
          callback(null, `${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`);
        },
      }),
      fileFilter: (_request, file, callback) => {
        if (!imageExtension(file.mimetype)) {
          callback(new BadRequestException('仅支持 JPEG、PNG 或 WebP 图片'), false);
          return;
        }
        callback(null, true);
      },
      limits: {
        fileSize: 3 * 1024 * 1024,
      },
    }),
  )
  async uploadProductImage(@UploadedFile() file?: UploadFile) {
    if (!file) throw new BadRequestException('请选择图片文件');
    if (!await hasValidImageSignature(file.path, file.mimetype)) {
      await unlink(file.path);
      throw new BadRequestException('图片内容与文件类型不匹配');
    }
    const optimizedFilename = `${file.filename.slice(0, -extname(file.filename).length)}.webp`;
    const optimizedPath = join(productUploadDir, optimizedFilename);
    try {
      await optimizeProductImage(file.path, optimizedPath);
      await unlink(file.path);
      return {
        url: `/uploads/products/${optimizedFilename}`,
      };
    } catch {
      await Promise.all([
        unlink(file.path).catch(() => undefined),
        unlink(optimizedPath).catch(() => undefined),
      ]);
      throw new BadRequestException('图片处理失败，请更换图片后重试');
    }
  }
}

function imageExtension(mimetype: string): string {
  if (mimetype === 'image/jpeg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  return '';
}

async function hasValidImageSignature(path: string, mimetype: string): Promise<boolean> {
  const file = await open(path, 'r');
  const header = Buffer.alloc(12);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await file.read(header, 0, header.length, 0));
  } finally {
    await file.close();
  }
  const signature = header.subarray(0, bytesRead);
  if (mimetype === 'image/jpeg') return signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  if (mimetype === 'image/png') return signature.length >= 8 && signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === 'image/webp') return signature.length >= 12 && signature.subarray(0, 4).toString() === 'RIFF' && signature.subarray(8, 12).toString() === 'WEBP';
  return false;
}
