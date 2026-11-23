import { MerchantImageController } from './merchant/merchant-image.controller';
import { MerchantImageService } from './merchant/merchant-image.service';
import { MerchantImageScopeGuard } from './merchant/merchant-image-scope.guard';
import { ProductImageStorage } from './merchant/product-image-storage';
import { ProductImageCleanupService } from './merchant/product-image-cleanup.service';
import { MerchantCategoryService } from './merchant/merchant-category.service';
import { MerchantCatalogController } from './merchant/merchant-catalog.controller';
import { MerchantCatalogService } from './merchant/merchant-catalog.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { MerchantModule } from '../merchant/merchant.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductConfigurationService } from './product-configuration.service';

@Module({
  imports: [AuthModule, StoresModule, MerchantModule],
  controllers: [ProductsController, MerchantCatalogController, MerchantImageController],
  providers: [MerchantImageService, MerchantImageScopeGuard, ProductImageStorage, ProductImageCleanupService, MerchantCategoryService, MerchantCatalogService, ProductsService, ProductConfigurationService],
  exports: [ProductsService],
})
export class ProductsModule {}
