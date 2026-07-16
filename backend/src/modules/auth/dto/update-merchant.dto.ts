import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMerchantDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['store-id-1'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  storeIds?: string[];
}
