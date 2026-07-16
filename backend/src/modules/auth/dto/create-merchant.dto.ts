import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, Length } from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty({ example: 'merchant-demo' })
  @IsString()
  @Length(3, 64)
  username!: string;

  @ApiProperty({ example: '13800000000' })
  @IsString()
  @Length(7, 32)
  phone!: string;

  @ApiProperty({ example: 'merchant-password-123' })
  @IsString()
  @Length(12, 256)
  password!: string;

  @ApiProperty({ type: [String], example: ['store-id-1'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  storeIds!: string[];
}
