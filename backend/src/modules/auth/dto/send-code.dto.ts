import { VerificationPurpose } from '@lingdian/db';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendCodeDto {
  @IsEnum(VerificationPurpose)
  purpose!: VerificationPurpose;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;
}
