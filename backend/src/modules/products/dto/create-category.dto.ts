import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称', example: '招牌饮品' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '排序值', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ description: '是否在小程序展示', example: true })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

