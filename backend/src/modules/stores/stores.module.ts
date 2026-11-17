import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Module } from '@nestjs/common';
import {
  SingleStoreContextResolver,
  MultiStoreContextResolver,
  StoreContextResolver,
} from './store-context.resolver';
import { StoresController } from './stores.controller';

@Module({
  controllers: [StoresController],
  providers: [{
    provide: StoreContextResolver,
    inject: [PrismaService, ConfigService],
    useFactory: (prisma: PrismaService, config: ConfigService) => config.get<string>('store.mode') === 'multi'
      ? new MultiStoreContextResolver(prisma, config)
      : new SingleStoreContextResolver(prisma, config),
  }],
  exports: [StoreContextResolver],
})
export class StoresModule {}
