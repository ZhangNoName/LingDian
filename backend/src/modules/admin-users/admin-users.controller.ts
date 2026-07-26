import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { AdminUsersService } from './admin-users.service';
import { QueryPlatformUsersDto } from './dto/query-platform-users.dto';

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
}
