import { IsString, Length } from 'class-validator';
export class CurrentPasswordChangeDto {
  @IsString() currentPassword!: string;
  @IsString() @Length(12, 256) password!: string;
}
