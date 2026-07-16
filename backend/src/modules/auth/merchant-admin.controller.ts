import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MerchantAdminService } from './merchant-admin.service';

@ApiTags('Merchant administration')
@ApiBearerAuth()
@Controller('admin/merchants')
@UseGuards(AccessTokenGuard, SuperAdminGuard)
export class MerchantAdminController {
  constructor(private readonly merchants: MerchantAdminService) {}

  @ApiOperation({ summary: 'Create a store-scoped merchant account' })
  @Post()
  create(@Body() body: CreateMerchantDto) {
    return this.merchants.create(body);
  }

  @ApiOperation({ summary: 'List store-scoped merchant accounts' })
  @Get()
  list() {
    return this.merchants.list();
  }

  @ApiOperation({ summary: 'Update merchant status or store scopes' })
  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() body: UpdateMerchantDto) {
    return this.merchants.update(userId, body);
  }
}
