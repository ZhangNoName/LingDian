import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: '分类 ID', example: 'cmofp2e5k0000w0j66zjobzse' })
  @IsString()
  category_id!: string;

  @ApiProperty({ description: '餐品名称', example: '招牌拿铁' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '餐品描述', example: '醇厚奶香，默认热饮' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '图片 URL', example: '/uploads/products/latte.jpg' })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiProperty({ description: '默认售价', example: 18 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: '库存入口，当前不阻断下单', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: '是否推荐', example: false })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;
}

