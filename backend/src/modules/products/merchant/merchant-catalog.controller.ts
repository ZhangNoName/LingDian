import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../../common/auth/access-token.guard';
import { MerchantGuard } from '../../../common/auth/merchant.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { MerchantCategoryService } from './merchant-category.service';
import { MerchantCatalogService } from './merchant-catalog.service';
import {
  CreateMerchantProductDto,
  MerchantCategoryDto,
  MerchantCategoryQueryDto,
  MerchantProductStatusDto,
  UpdateMerchantProductDto,
  UpdateMerchantCategoryDto,
} from './merchant-catalog.dto';
@ApiTags('Merchant catalogue')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, MerchantGuard)
@Controller('merchant/stores/:storeId')
export class MerchantCatalogController {
  constructor(
    private readonly catalog: MerchantCatalogService,
    private readonly categoriesService: MerchantCategoryService,
  ) {}
  @Get('categories') categories(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: MerchantCategoryQueryDto,
  ) {
    return this.catalog.categories(user, storeId, query);
  }
  @Post('categories') category(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() body: MerchantCategoryDto,
  ) {
    return this.catalog.createCategory(user, storeId, body);
  }
  @Patch('categories/:id') updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: UpdateMerchantCategoryDto,
  ) {
    return this.categoriesService.update(user, store, id, body);
  }
  @Post('products') create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() body: CreateMerchantProductDto,
  ) {
    return this.catalog.create(user, storeId, body);
  }
  @Patch('products/:id/details') details(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: UpdateMerchantProductDto,
  ) {
    return this.catalog.details(user, storeId, id, body);
  }
  @Patch('products/:id/status') status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: MerchantProductStatusDto,
  ) {
    return this.catalog.status(user, storeId, id, body);
  }
}
