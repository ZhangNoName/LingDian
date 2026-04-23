import { Type } from 'class-transformer';
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

class OrderItemDto {
  @IsOptional()
  @IsNotEmpty()
  skuId?: string | number;

  @IsOptional()
  @IsNotEmpty()
  sku_id?: string | number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateOrderDto {
  @IsString()
  storeId!: string;

  @IsIn(['dine_in', 'takeout', 'pickup'])
  orderType!: 'dine_in' | 'takeout' | 'pickup';

  @IsString()
  customerName!: string;

  @IsMobilePhone('zh-CN')
  mobile!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsString()
  couponCode?: string;
}
