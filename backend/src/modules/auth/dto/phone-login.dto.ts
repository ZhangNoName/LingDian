import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class PhoneLoginDto {
  @ApiProperty({ example: '13800000000' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ enum: ['user-api', 'admin-api'], example: 'user-api' })
  @IsIn(['user-api', 'admin-api'])
  audience!: 'user-api' | 'admin-api';
}
