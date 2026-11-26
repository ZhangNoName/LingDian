import {
  Body, Controller, ForbiddenException, Headers, HttpCode, Ip, Post, Header,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length, Matches } from 'class-validator';
import type { AuthenticatedUser, MobileAccountLoginResult } from '@lingdian/contracts';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccountAuthService } from './account-auth.service';
import { AuthService } from './auth.service';
import { AccountLoginDto, MobileAccountLoginDto } from './dto/account-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { isMobileSessionDevice, SessionService, type SessionTokens } from './session.service';

class MobileRefreshDto {
  @IsString()
  @Length(43, 43)
  @Matches(/^[A-Za-z0-9_-]+$/)
  refreshToken!: string;
}

@ApiTags('Mobile authentication')
@Controller('auth/mobile')
export class MobileAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accounts: AccountAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('account/login')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async accountLogin(
    @Body() { username, password, audience }: MobileAccountLoginDto,
    @Headers('x-device-id') device: string | undefined,
    @Ip() ip: string,
  ): Promise<MobileAccountLoginResult> {
    const context = mobileContext(device, ip);
    if (audience) return mobileTokens(await this.accounts.login({ username, password, audience }, context));
    const result = await this.accounts.loginWithRoleDetection({ username, password }, context);
    return 'audiences' in result ? result : mobileTokens(result);
  }

  @Post('phone/login')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async phoneLogin(@Body() body: PhoneLoginDto, @Headers('x-device-id') device: string | undefined, @Ip() ip: string) {
    return mobileTokens(await this.auth.phoneLogin(body, mobileContext(device, ip), { requireCustomerRole: true, legalConsentChannel: 'mobile' }));
  }

  @Post('account/switch')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async switchAccountRole(
    @Body() body: AccountLoginDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-device-id') device: string | undefined,
    @Ip() ip: string,
  ) {
    return mobileTokens(await this.accounts.login(body, mobileContext(device, ip), user.userId));
  }

  @Post('phone/switch')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async switchPhoneRole(
    @Body() body: PhoneLoginDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-device-id') device: string | undefined,
    @Ip() ip: string,
  ) {
    if (body.audience === 'user-api' && !user.roles.includes('USER')) {
      throw new ForbiddenException('Customer role required.');
    }
    return mobileTokens(await this.auth.phoneLogin(body, mobileContext(device, ip), {
      expectedUserId: user.userId, requireCustomerRole: true, legalConsentChannel: 'mobile',
    }));
  }

  @Post('refresh')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Body() body: MobileRefreshDto, @Headers('x-device-id') device: string | undefined, @Ip() ip: string) {
    const context = mobileContext(device, ip);
    return mobileTokens(await this.sessions.refresh(body.refreshToken, { ip, device: context.deviceId }, context.deviceId));
  }
}

function mobileContext(device: string | undefined, ip: string) {
  const deviceId = `lingdian-app:${device ?? ''}`;
  if (!isMobileSessionDevice(deviceId)) {
    throw new UnauthorizedException('A valid mobile installation identifier is required.');
  }
  return { deviceId, ip };
}

function mobileTokens(tokens: SessionTokens) {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_in: tokens.expiresIn,
    user: tokens.user,
    ...(tokens.isNewUser ? { is_new_user: true as const } : {}),
  };
}
