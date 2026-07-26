import type { PlatformUserStatus } from '@lingdian/contracts';
import { IsIn } from 'class-validator';
export class SetPlatformUserStatusDto { @IsIn(['ACTIVE', 'DISABLED']) status!: PlatformUserStatus; }
