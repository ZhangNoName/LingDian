import { Controller, Get, Header, Headers, HttpCode, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { AuthenticatedUser } from '@lingdian/contracts';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MobileInboxService } from './mobile-inbox.service';

class InboxQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  cursor?: string;
}

class InboxReadAllQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  throughId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  throughCreatedAt?: string;
}

@ApiTags('Mobile inbox')
@Controller('mobile/inbox')
@UseGuards(AccessTokenGuard)
export class MobileInboxController {
  constructor(private readonly inbox: MobileInboxService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  page(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId: string | undefined, @Query() query: InboxQueryDto) {
    return this.inbox.page(user, storeId, query.cursor);
  }

  @Get('unread')
  @Header('Cache-Control', 'no-store')
  unread(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId: string | undefined) {
    return this.inbox.unread(user, storeId);
  }

  @Patch('read-all')
  @HttpCode(204)
  readAll(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-store-id') storeId: string | undefined,
    @Query() query: InboxReadAllQueryDto,
  ) {
    const through = query.throughId !== undefined || query.throughCreatedAt !== undefined
      ? { id: query.throughId ?? '', createdAt: query.throughCreatedAt ?? '' }
      : undefined;
    return this.inbox.markRead(user, storeId, undefined, through);
  }

  @Patch(':id/read')
  @HttpCode(204)
  read(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId: string | undefined, @Param('id') id: string) {
    return this.inbox.markRead(user, storeId, id);
  }
}
