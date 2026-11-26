import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { OrderStatus, PaymentChannel } from '@lingdian/db';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Target order status',
    enum: OrderStatus,
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({ description: 'Order status displayed at confirmation', enum: OrderStatus })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(OrderStatus)
  expectedStatus?: OrderStatus;

  @ApiPropertyOptional({ description: 'Payment channel displayed at confirmation', enum: PaymentChannel })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PaymentChannel)
  expectedPaymentChannel?: PaymentChannel;

  @ApiPropertyOptional({
    description: 'Operator name',
    example: 'System Admin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  operatorName?: string;

  @ApiPropertyOptional({
    description: 'Change note',
    example: 'Customer paid at counter',
  })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  note?: string;
}
