import { IsIn, IsString, Length, Matches } from 'class-validator';

export class PasswordResetDto {
  @IsString()
  @Length(3, 64)
  username!: string;

  @IsIn(['merchant-api'])
  audience!: 'merchant-api';

  @Matches(/^\d{6}$/)
  code!: string;

  @IsString()
  @Length(12, 256)
  password!: string;
}
