import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemLogAdminController, SystemLogClientController } from './system-log.controller';
import { SystemLogService } from './system-log.service';

@Module({
  imports: [AuthModule],
  controllers: [SystemLogClientController, SystemLogAdminController],
  providers: [SystemLogService],
  exports: [SystemLogService],
})
export class SystemLogModule {}
