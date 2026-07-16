import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class UpdateNicknameDto {
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Length(1, 32)
  nickname!: string;
}
