import { Module } from '@nestjs/common';
import {
  SingleStoreContextResolver,
  StoreContextResolver,
} from './store-context.resolver';
import { StoresController } from './stores.controller';

@Module({
  controllers: [StoresController],
  providers: [
    SingleStoreContextResolver,
    { provide: StoreContextResolver, useExisting: SingleStoreContextResolver },
  ],
  exports: [StoreContextResolver],
})
export class StoresModule {}
