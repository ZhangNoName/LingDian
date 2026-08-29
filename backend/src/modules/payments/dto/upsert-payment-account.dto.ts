import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpsertPaymentAccountDto {
  @ApiProperty() @IsString() storeId!: string;
  @ApiProperty({ enum: ['WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'] })
  @IsIn(['WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'])
  provider!: 'WECHAT_PAY' | 'ALIPAY' | 'UNIONPAY' | 'STRIPE' | 'PAYPAL';
  @ApiProperty({ enum: ['WECHAT', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'] })
  @IsIn(['WECHAT', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL'])
  channel!: 'WECHAT' | 'ALIPAY' | 'UNIONPAY' | 'STRIPE' | 'PAYPAL';
  @ApiProperty({ description: 'Merchant/connected-account id at the provider' })
  @IsString() @Length(2, 191) externalAccountId!: string;
  @ApiProperty({ description: 'Non-secret key used to select credentials in the secret store' })
  @Matches(/^[A-Z0-9_]{2,64}$/) connectorConfigKey!: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: 'ACTIVE' | 'DISABLED';
}
