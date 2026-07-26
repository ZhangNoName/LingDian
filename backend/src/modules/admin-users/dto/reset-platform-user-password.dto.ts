import { IsString, Length } from 'class-validator';
export class ResetPlatformUserPasswordDto { @IsString() @Length(12, 256) password!: string; }
