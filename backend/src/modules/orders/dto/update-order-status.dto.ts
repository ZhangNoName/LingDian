import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Target order status',
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
  status!: string;

  @ApiPropertyOptional({
    description: 'Operator name',
    example: 'System Admin',
  })
  @IsOptional()
  @IsString()
  operatorName?: string;

  @ApiPropertyOptional({
    description: 'Change note',
    example: 'Customer paid at counter',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
