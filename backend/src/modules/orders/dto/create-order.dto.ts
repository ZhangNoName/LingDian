import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  Length,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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
  @Max(99)
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
  @Max(99)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Item remark',
    example: 'Less ice',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
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
  @ApiPropertyOptional({
    description: 'Stable client request id used to make authenticated checkout idempotent',
    example: 'checkout-m5z8v8k2-a1b2c3d4',
  })
  @IsOptional()
  @IsString()
  @Length(8, 64)
  clientRequestId?: string;

  @ApiPropertyOptional({
    description: 'Store id; omitted requests use the configured primary store',
    example: 'cmofp2e5k0000w0j66zjobzse',
  })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty({
    description: 'Order type',
    enum: ['dine_in', 'takeout', 'pickup'],
    example: 'takeout',
  })
  @IsIn(['dine_in', 'takeout', 'pickup'])
  orderType!: 'dine_in' | 'takeout' | 'pickup';

  @ApiPropertyOptional({
    description: 'Owned customer address id, required for takeout delivery',
    example: 'cmofp2address12345',
  })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({
    description: 'Payment channel',
    enum: ['cash', 'wechat', 'alipay', 'unionpay', 'stripe', 'paypal', 'customer_scan', 'other'],
    example: 'wechat',
  })
  @IsOptional()
  @IsIn(['cash', 'wechat', 'alipay', 'unionpay', 'stripe', 'paypal', 'customer_scan', 'other'])
  paymentChannel?: 'cash' | 'wechat' | 'alipay' | 'unionpay' | 'stripe' | 'paypal' | 'customer_scan' | 'other';

  @ApiPropertyOptional({
    description: 'Customer name',
    example: 'Zhang San',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerName?: string;

  @ApiPropertyOptional({
    description: 'Customer mobile number',
    example: '13800000000',
  })
  @IsOptional()
  @IsMobilePhone('zh-CN')
  mobile?: string;

  @ApiProperty({
    description: 'Order items',
    type: [OrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({
    description: 'Coupon code',
    example: 'NEW8',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Order remark',
    example: 'Deliver as soon as possible',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
