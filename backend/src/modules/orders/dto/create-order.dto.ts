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

export class OrderItemDto {
  @ApiPropertyOptional({
    description: 'SKU ID，兼容旧字段 skuId',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsOptional()
  @IsNotEmpty()
  skuId?: string | number;

  @ApiPropertyOptional({
    description: 'SKU ID，推荐字段',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsOptional()
  @IsNotEmpty()
  sku_id?: string | number;

  @ApiProperty({
    description: '购买数量',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: '单项备注',
    example: '少冰',
  })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: '门店 ID',
    example: 'cmofp2e5k0000w0j66zjobzse',
  })
  @IsString()
  storeId!: string;

  @ApiProperty({
    description: '下单方式',
    enum: ['dine_in', 'takeout', 'pickup'],
    example: 'takeout',
  })
  @IsIn(['dine_in', 'takeout', 'pickup'])
  orderType!: 'dine_in' | 'takeout' | 'pickup';

  @ApiProperty({
    description: '顾客姓名',
    example: '张三',
  })
  @IsString()
  customerName!: string;

  @ApiProperty({
    description: '顾客手机号',
    example: '13800000000',
  })
  @IsMobilePhone('zh-CN')
  mobile!: string;

  @ApiProperty({
    description: '订单商品列表',
    type: [OrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({
    description: '优惠券编码',
    example: 'NEW8',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
