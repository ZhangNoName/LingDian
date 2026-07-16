import { IsIn, IsString, Length } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  @Length(1, 2048)
  code!: string;

  @IsString()
  @Length(16, 256)
  state!: string;

  @IsIn(['user-api'])
  audience!: 'user-api';
}
