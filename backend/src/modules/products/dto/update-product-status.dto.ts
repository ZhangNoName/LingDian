import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateProductStatusDto {
  @ApiProperty({ description: '餐品状态', enum: ProductStatus })
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}

