import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
export class MerchantImageDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) requestId!: string;
  @Transform(({ value }) => (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : value))
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expected_version!: number;
}
