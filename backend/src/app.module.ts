import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MenuModule } from './modules/menu/menu.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { StoresModule } from './modules/stores/stores.module';
import { SystemLogModule } from './modules/system-log/system-log.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AddressesModule } from './modules/addresses/addresses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    PrismaModule,
    AdminUsersModule,
    AddressesModule,
    AuthModule,
    MerchantModule,
    HealthModule,
    StoresModule,
    MenuModule,
    ProductsModule,
    OrdersModule,
    SystemLogModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
