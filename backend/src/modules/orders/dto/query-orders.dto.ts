import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryOrdersDto {
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
    enum: ['CASH', 'WECHAT', 'ALIPAY', 'CUSTOMER_SCAN', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['CASH', 'WECHAT', 'ALIPAY', 'CUSTOMER_SCAN', 'OTHER'])
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
