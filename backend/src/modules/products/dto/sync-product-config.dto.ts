import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProductType,
  SelectionGroupType,
  SelectionMode,
  SelectionOptionType,
  SelectionScope,
} from '@prisma/client';

export class SyncSelectionOptionDto {
  @ApiPropertyOptional({ description: '现有选项 ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: '选项名称', example: '不要生菜' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: '选项类型',
    enum: SelectionOptionType,
    example: SelectionOptionType.VALUE,
  })
  @IsEnum(SelectionOptionType)
  option_type!: SelectionOptionType;

  @ApiPropertyOptional({ description: '价格增量', example: 2 })
  @IsOptional()
  @IsNumber()
  price_delta?: number;

  @ApiPropertyOptional({ description: '库存增量', example: 0 })
  @IsOptional()
  @IsInt()
  stock_delta?: number;

  @ApiPropertyOptional({ description: '是否默认选中', example: false })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: '排序', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({
    description: '当选项类型为 VARIANT 时，引用的 SKU ID',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsOptional()
  @IsString()
  referenced_sku_id?: string;
}

export class SyncSelectionGroupPayloadDto {
  @ApiPropertyOptional({ description: '现有选择组 ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: '选择组名称', example: '辣度' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: '选择组类型',
    enum: SelectionGroupType,
    example: SelectionGroupType.MODIFIER,
  })
  @IsEnum(SelectionGroupType)
  group_type!: SelectionGroupType;

  @ApiProperty({
    description: '选择模式',
    enum: SelectionMode,
    example: SelectionMode.SINGLE,
  })
  @IsEnum(SelectionMode)
  selection_mode!: SelectionMode;

  @ApiPropertyOptional({ description: '最少选择数量', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  min_select?: number;

  @ApiPropertyOptional({ description: '最多选择数量', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_select?: number;

  @ApiPropertyOptional({ description: '是否必选', example: false })
  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: '排序', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ description: '说明', example: '支持辣度与去料配置' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: '选择项列表',
    type: [SyncSelectionOptionDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncSelectionOptionDto)
  options!: SyncSelectionOptionDto[];
}

export class SyncProductSelectionBindingDto {
  @ApiPropertyOptional({ description: '现有绑定 ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    description: '绑定范围',
    enum: SelectionScope,
    example: SelectionScope.PRODUCT,
  })
  @IsEnum(SelectionScope)
  scope!: SelectionScope;

  @ApiPropertyOptional({
    description: '当 scope=VARIANT 时，绑定到的 SKU ID',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsOptional()
  @IsString()
  target_variant_id?: string;

  @ApiPropertyOptional({ description: '排序', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @ApiProperty({
    description: '选择组配置',
    type: SyncSelectionGroupPayloadDto,
  })
  @ValidateNested()
  @Type(() => SyncSelectionGroupPayloadDto)
  group!: SyncSelectionGroupPayloadDto;
}

export class SyncProductVariantDto {
  @ApiPropertyOptional({ description: '现有 SKU ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: '规格名称', example: '单品' })
  @IsString()
  sku_name!: string;

  @ApiProperty({ description: '售价', example: 19.9 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ description: '库存', example: 120 })
  @IsInt()
  @Min(0)
  stock_count!: number;

  @ApiPropertyOptional({ description: '是否默认规格', example: false })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class SyncProductConfigDto {
  @ApiPropertyOptional({
    description: '商品类型',
    enum: ProductType,
    example: ProductType.SINGLE,
  })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiProperty({
    description: '商品规格列表',
    type: [SyncProductVariantDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncProductVariantDto)
  variants!: SyncProductVariantDto[];

  @ApiPropertyOptional({
    description: '商品绑定的选择组',
    type: [SyncProductSelectionBindingDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncProductSelectionBindingDto)
  selection_groups?: SyncProductSelectionBindingDto[];
}
