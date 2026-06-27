import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '@lingdian/db';
import { IsEnum } from 'class-validator';

export class UpdateProductStatusDto {
  @ApiProperty({ description: '餐品状态', enum: ProductStatus })
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}
