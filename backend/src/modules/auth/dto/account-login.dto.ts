import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

export class AccountLoginDto {
  @ApiProperty({ example: 'merchant-one' })
  @IsString()
  @Length(3, 64)
  username!: string;

  @ApiProperty({ example: 'merchant-password-123' })
  @IsString()
  @Length(8, 256)
  password!: string;

  @ApiProperty({ enum: ['admin-api', 'merchant-api'], example: 'merchant-api' })
  @IsIn(['admin-api', 'merchant-api'])
  audience!: 'admin-api' | 'merchant-api';
}
