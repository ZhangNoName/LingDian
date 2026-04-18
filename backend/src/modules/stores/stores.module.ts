import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';

@Module({
  controllers: [StoresController],
})
export class StoresModule {}
