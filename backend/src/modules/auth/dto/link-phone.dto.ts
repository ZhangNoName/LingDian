import { IsString, Length, Matches } from 'class-validator';

export class LinkPhoneDto {
  @IsString()
  @Length(1, 128)
  pendingOauthId!: string;

  @IsString()
  @Length(11, 16)
  phone!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}
