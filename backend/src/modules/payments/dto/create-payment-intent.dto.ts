import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

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
}
