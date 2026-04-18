import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsMobilePhone,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class OrderItemDto {
  @IsString()
  skuId!: string;

  @IsNumber()
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
