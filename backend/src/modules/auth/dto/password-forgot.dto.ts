import { IsIn, IsString, Length } from 'class-validator';

export class PasswordForgotDto {
  @IsString()
  @Length(3, 64)
  username!: string;

  @IsIn(['merchant-api'])
  audience!: 'merchant-api';
}
