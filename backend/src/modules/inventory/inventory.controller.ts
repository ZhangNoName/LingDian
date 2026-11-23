import { InventoryTrendService } from './trend/inventory-trend.service';
import { InventoryTrendDto } from './trend/inventory-trend.dto';
import { InventoryMaterialService } from './inventory-material.service';
import { InventoryMaterialChangesDto, RenameInventoryMaterialDto } from './dto/inventory-material.dto';
import { InventoryUsageService } from './inventory-usage.service';
import { InventoryUsageQueryDto } from './dto/inventory-usage.dto';
import { InventoryAlertService } from './inventory-alert.service';
import { AcknowledgeInventoryAlertDto, InventoryAlertQueryDto } from './dto/inventory-alert.dto';
import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { ChangeInventoryLifecycleDto, AdjustInventoryDto, CreateInventoryItemDto, InventoryHistoryQueryDto, InventoryQueryDto, InventoryReportQueryDto } from './dto/inventory.dto';
import { InventoryRecipeService } from './inventory-recipe.service';
import { RecipeQueryDto, SaveRecipeDto } from './dto/inventory-recipe.dto';
import { InventoryReportService } from './inventory-report.service';
import { InventoryLifecycleService } from './inventory-lifecycle.service';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, MerchantGuard)
@Controller('merchant/stores/:storeId/inventory')
export class InventoryController {
  constructor(private readonly trends: InventoryTrendService, private readonly materials: InventoryMaterialService, private readonly usage: InventoryUsageService, private readonly lifecycle: InventoryLifecycleService, private readonly inventory: InventoryService, private readonly reports: InventoryReportService, private readonly recipes: InventoryRecipeService, private readonly alerts: InventoryAlertService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Query() query: InventoryQueryDto) {
    return this.inventory.list(user, storeId, query);
  }

  @Get('movements')
  history(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Query() query: InventoryHistoryQueryDto) {
    return this.inventory.history(user, storeId, query);
  }

  @Get('report')
  report(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Query() query: InventoryReportQueryDto) {
    return this.reports.report(user, storeId, query);
  }

  @Get('alerts')
  listAlerts(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Query() query: InventoryAlertQueryDto) {
    return this.alerts.list(user, storeId, query);
  }

  @Get('alerts/:alertId')
  alertDetail(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('alertId') alertId: string) {
    return this.alerts.detail(user, storeId, alertId);
  }

  @Post('alerts/:alertId/acknowledge')
  acknowledgeAlert(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('alertId') alertId: string, @Body() body: AcknowledgeInventoryAlertDto) {
    return this.alerts.acknowledge(user, storeId, alertId, body);
  }

  @Get('recipes')
  listRecipes(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Query() query: RecipeQueryDto) {
    return this.recipes.list(user, storeId, query);
  }

  @Put('recipes/:skuId')
  saveRecipe(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('skuId') skuId: string, @Body() body: SaveRecipeDto) {
    return this.recipes.save(user, storeId, skuId, body);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Body() body: CreateInventoryItemDto) {
    return this.inventory.create(user, storeId, body);
  }

  @Post(':itemId/movements')
  adjust(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string, @Body() body: AdjustInventoryDto) {
    return this.inventory.adjust(user, storeId, itemId, body);
  }
  @Get('items/:itemId')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string) { return this.lifecycle.detail(user, storeId, itemId); }
  @Put('items/:itemId/lifecycle')
  changeLifecycle(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string, @Body() body: ChangeInventoryLifecycleDto) { return this.lifecycle.change(user, storeId, itemId, body); }

  @Get('items/:itemId/trend')
  materialTrend(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string, @Query() query: InventoryTrendDto) { return this.trends.report(user, storeId, itemId, query); }

  @Put('items/:itemId/name')
  renameMaterial(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string, @Body() body: RenameInventoryMaterialDto) { return this.materials.rename(user, storeId, itemId, body); }
  @Get('items/:itemId/changes')
  materialChanges(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string, @Query() query: InventoryMaterialChangesDto) { return this.materials.changes(user, storeId, itemId, query); }

  @Get('items/:itemId/usage')
  materialUsage(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('itemId') itemId: string, @Query() query: InventoryUsageQueryDto) { return this.usage.usage(user, storeId, itemId, query); }
  @Get('recipes/:skuId')
  recipeDetail(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Param('skuId') skuId: string) { return this.recipes.detail(user, storeId, skuId); }

}
