import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [MenuController],
})
export class MenuModule {}
