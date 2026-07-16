import { IsIn, IsString, Length } from 'class-validator';

export class MiniProgramOAuthCallbackDto {
  @IsString()
  @Length(1, 2048)
  code!: string;

  @IsIn(['user-api'])
  audience!: 'user-api';
}
