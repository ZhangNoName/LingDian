import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const ORDER_QUERY_PAYMENT_CHANNELS = [
  'CASH',
  'WECHAT',
  'ALIPAY',
  'UNIONPAY',
  'STRIPE',
  'PAYPAL',
  'CUSTOMER_SCAN',
  'OTHER',
] as const;

export class QueryOrdersDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Rows per page', default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 50;

  @ApiPropertyOptional({
    description: 'Keyword for order number, customer name, customer mobile, or remark',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Order status',
    enum: [
      'CREATING',
      'PENDING_PAYMENT',
      'PAID',
      'PREPARING',
      'READY',
      'COMPLETED',
      'TIMED_OUT',
      'REFUNDING',
      'REFUNDED',
      'CANCELLED',
      'FAILED',
      'DELETED',
    ],
  })
  @IsOptional()
  @IsIn([
    'CREATING',
    'PENDING_PAYMENT',
    'PAID',
    'PREPARING',
    'READY',
    'COMPLETED',
    'TIMED_OUT',
    'REFUNDING',
    'REFUNDED',
    'CANCELLED',
    'FAILED',
    'DELETED',
  ])
  status?: string;

  @ApiPropertyOptional({
    description: 'Order type',
    enum: ['DINE_IN', 'TAKEOUT', 'PICKUP'],
  })
  @IsOptional()
  @IsIn(['DINE_IN', 'TAKEOUT', 'PICKUP'])
  orderType?: string;

  @ApiPropertyOptional({
    description: 'Payment channel',
    enum: ORDER_QUERY_PAYMENT_CHANNELS,
  })
  @IsOptional()
  @IsIn(ORDER_QUERY_PAYMENT_CHANNELS)
  paymentChannel?: string;

  @ApiPropertyOptional({
    description: 'Start date in ISO string',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date in ISO string',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  endDate?: string;
}
