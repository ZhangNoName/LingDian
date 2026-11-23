import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({ enum: ['WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'] })
  @IsIn(['WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'])
  provider!: 'WECHAT_PAY' | 'ALIPAY' | 'UNIONPAY' | 'STRIPE' | 'PAYPAL';

  @ApiProperty({ enum: ['WECHAT', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'] })
  @IsIn(['WECHAT', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'])
  channel!: 'WECHAT' | 'ALIPAY' | 'UNIONPAY' | 'STRIPE' | 'PAYPAL';

  @ApiProperty({ description: 'A stable key for one checkout attempt' })
  @IsString()
  @Length(8, 64)
  clientRequestId!: string;

  @ApiPropertyOptional({ description: 'Fresh wx.login code for mini-program checkout' })
  @IsOptional()
  @IsString()
  @Length(1, 256)
  miniProgramLoginCode?: string;
}
