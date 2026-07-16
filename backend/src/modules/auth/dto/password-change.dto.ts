import { IsString, Length, Matches } from 'class-validator';

export class PasswordChangeDto {
  @Matches(/^\d{6}$/)
  code!: string;

  @IsString()
  @Length(12, 256)
  password!: string;
}
