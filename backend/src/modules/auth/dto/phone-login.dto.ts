import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsIn, IsNotEmpty, IsString, Length, ValidateIf, ValidateNested } from 'class-validator';
import { LegalConsentDto } from './legal-consent.dto';

export class PhoneLoginDto {
  @ApiProperty({ example: '13800000000' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ enum: ['user-api', 'admin-api'], example: 'user-api' })
  @IsIn(['user-api', 'admin-api'])
  audience!: 'user-api' | 'admin-api';

  @ValidateIf((input: PhoneLoginDto) => input.audience === 'user-api')
  @IsDefined()
  @ValidateNested()
  @Type(() => LegalConsentDto)
  legalConsent?: LegalConsentDto;
}
