import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { AdminUsersService } from './admin-users.service';
import { QueryPlatformUsersDto } from './dto/query-platform-users.dto';
import { SetPlatformUserStatusDto } from './dto/set-platform-user-status.dto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { UpdatePlatformUserDto } from './dto/update-platform-user.dto';
import { ResetPlatformUserPasswordDto } from './dto/reset-platform-user-password.dto';

@ApiTags('Admin Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: QueryPlatformUsersDto) {
    return this.users.list(query);
  }

  @Get(':userId')
  get(@Param('userId') userId: string) {
    return this.users.get(userId);
  }

  @Post()
  create(@CurrentUser() operator: AuthenticatedUser, @Body() body: CreatePlatformUserDto) {
    return this.users.create(operator, body);
  }

  @Patch(':userId')
  update(@CurrentUser() operator: AuthenticatedUser, @Param('userId') userId: string, @Body() body: UpdatePlatformUserDto) {
    return this.users.update(operator, userId, body);
  }

  @Patch(':userId/status')
  setStatus(@CurrentUser() operator: AuthenticatedUser, @Param('userId') userId: string, @Body() body: SetPlatformUserStatusDto) {
    return this.users.setStatus(operator, userId, body.status);
  }

  @Post(':userId/password-reset')
  resetPassword(@CurrentUser() operator: AuthenticatedUser, @Param('userId') userId: string, @Body() body: ResetPlatformUserPasswordDto) {
    return this.users.resetPassword(operator, userId, body.password);
  }
}
