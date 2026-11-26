import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/create-address.dto';

@ApiTags('Customer Addresses')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, UserApiGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @ApiOperation({ summary: 'List the current customer addresses' })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.list(user.userId);
  }

  @ApiOperation({ summary: 'Create or reuse a customer address' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAddressDto) {
    return this.addresses.create(user.userId, body);
  }

  @ApiOperation({ summary: 'Update a current customer address using the last seen revision' })
  @Put(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') addressId: string, @Body() body: UpdateAddressDto) {
    return this.addresses.update(user.userId, addressId, body);
  }

  @ApiOperation({ summary: 'Set the current customer default address' })
  @Patch(':id/default')
  setDefault(@CurrentUser() user: AuthenticatedUser, @Param('id') addressId: string) {
    return this.addresses.setDefault(user.userId, addressId);
  }

  @ApiOperation({ summary: 'Delete a current customer address' })
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') addressId: string) {
    return this.addresses.remove(user.userId, addressId);
  }
}
