import { IsBoolean } from 'class-validator';

export class SetIntegrationEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}
