import { IsString, Length, Matches } from 'class-validator';

export class UnlinkIdentityDto {
  @IsString()
  @Length(11, 16)
  phone!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}
