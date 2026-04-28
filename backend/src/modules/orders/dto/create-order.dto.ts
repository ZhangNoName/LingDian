import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemSelectionDto {
  @ApiPropertyOptional({
    description: 'Selection group id',
    example: 'cmofp2ez1000aw0j6abc12345',
  })
  @IsOptional()
  @IsString()
  selectionGroupId?: string;

  @ApiProperty({
    description: 'Selection option id',
    example: 'cmofp2ez1000bw0j6abc12345',
  })
  @IsString()
  selectionOptionId!: string;

  @ApiPropertyOptional({
    description: 'Selection quantity',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class OrderItemDto {
  @ApiPropertyOptional({
    description: 'SKU id, compatible with the legacy field name',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsOptional()
  @IsNotEmpty()
  skuId?: string | number;

  @ApiPropertyOptional({
    description: 'SKU id, preferred field name',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsOptional()
  @IsNotEmpty()
  sku_id?: string | number;

  @ApiProperty({
    description: 'Purchase quantity',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Item remark',
    example: 'Less ice',
  })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({
    description: 'Optional selections for the sku',
    type: [OrderItemSelectionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemSelectionDto)
  selections?: OrderItemSelectionDto[];
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Store id',
    example: 'cmofp2e5k0000w0j66zjobzse',
  })
  @IsString()
  storeId!: string;

  @ApiProperty({
    description: 'Order type',
    enum: ['dine_in', 'takeout', 'pickup'],
    example: 'takeout',
  })
  @IsIn(['dine_in', 'takeout', 'pickup'])
  orderType!: 'dine_in' | 'takeout' | 'pickup';

  @ApiPropertyOptional({
    description: 'Payment channel',
    enum: ['cash', 'wechat', 'alipay', 'customer_scan', 'other'],
    example: 'wechat',
  })
  @IsOptional()
  @IsIn(['cash', 'wechat', 'alipay', 'customer_scan', 'other'])
  paymentChannel?: 'cash' | 'wechat' | 'alipay' | 'customer_scan' | 'other';

  @ApiProperty({
    description: 'Customer name',
    example: 'Zhang San',
  })
  @IsString()
  customerName!: string;

  @ApiProperty({
    description: 'Customer mobile number',
    example: '13800000000',
  })
  @IsMobilePhone('zh-CN')
  mobile!: string;

  @ApiProperty({
    description: 'Order items',
    type: [OrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({
    description: 'Coupon code',
    example: 'NEW8',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Order remark',
    example: 'Deliver as soon as possible',
  })
  @IsOptional()
  @IsString()
  remark?: string;
}
