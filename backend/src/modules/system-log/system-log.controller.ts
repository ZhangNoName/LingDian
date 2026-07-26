import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { ClientLogEventDto } from './dto/client-log-event.dto';
import { QuerySystemLogsDto } from './dto/query-system-logs.dto';
import { SystemLogService } from './system-log.service';

type LogRequest = {
  ip?: string;
  get: (name: string) => string | undefined;
  user?: { userId: string; audience: 'user-api' | 'merchant-api' | 'admin-api' };
};
type ClientAudience = 'user-api' | 'merchant-api' | 'admin-api';

@ApiTags('System logs')
@Controller('system-logs')
@UseGuards(AccessTokenGuard)
export class SystemLogClientController {
  constructor(private readonly logs: SystemLogService) {}

  @ApiOperation({ summary: 'Ingest a bounded client warning or error event' })
  @Post('client-events')
  @HttpCode(HttpStatus.ACCEPTED)
  async recordClientEvent(@Body() body: ClientLogEventDto, @Req() request: LogRequest) {
    if (!request.user || !clientSourceMatchesAudience(body.source, request.user.audience)) {
      throw new ForbiddenException('Client log source does not match the active session.');
    }
    await this.logs.recordClientEvent({
      ...body,
      ip: request.ip,
      userId: request.user.userId,
      details: {
        ...body.details,
        userAgent: request.get('user-agent'),
      },
    });
    return { accepted: true };
  }
}

function clientSourceMatchesAudience(source: ClientLogEventDto['source'], audience: ClientAudience): boolean {
  return (source === 'MINIAPP' && audience === 'user-api')
    || (source === 'MERCHANT_WEB' && audience === 'merchant-api')
    || (source === 'ADMIN_WEB' && audience === 'admin-api');
}

@ApiTags('System logs')
@ApiBearerAuth()
@Controller('admin/system-logs')
@UseGuards(AccessTokenGuard, SuperAdminGuard)
export class SystemLogAdminController {
  constructor(private readonly logs: SystemLogService) {}

  @ApiOperation({ summary: 'Query operational logs as a super administrator' })
  @Get()
  list(@Query() query: QuerySystemLogsDto) {
    return this.logs.query({
      source: query.source,
      level: query.level,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
