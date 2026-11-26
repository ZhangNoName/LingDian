import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length, ValidateIf } from 'class-validator';

class AccountCredentialsDto {
  @ApiProperty({ example: 'merchant-one' })
  @IsString()
  @Length(3, 64)
  username!: string;

  @ApiProperty({ example: 'merchant-password-123' })
  @IsString()
  @Length(8, 256)
  password!: string;
}

export class AccountLoginDto extends AccountCredentialsDto {
  @ApiProperty({ enum: ['admin-api', 'merchant-api'], example: 'merchant-api' })
  @IsIn(['admin-api', 'merchant-api'])
  audience!: 'admin-api' | 'merchant-api';
}

export class MobileAccountLoginDto extends AccountCredentialsDto {
  @ApiProperty({ enum: ['admin-api', 'merchant-api'], required: false })
  @ValidateIf((_input, value) => value !== undefined)
  @IsIn(['admin-api', 'merchant-api'])
  audience?: AccountLoginDto['audience'];
}
