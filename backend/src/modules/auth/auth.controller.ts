import {
  Body,
  Controller,
  Get,
  HttpCode,
  Delete,
  Param,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { refreshCookieOptions } from '../../common/auth/http-security';
import { VerificationService } from './verification.service';
import { AuthService } from './auth.service';
import { SessionService, SessionTokens } from './session.service';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { MiniProgramOAuthCallbackDto } from './dto/mini-program-oauth-callback.dto';
import { CompleteOAuthLoginDto } from './dto/complete-oauth-login.dto';
import { LinkPhoneDto } from './dto/link-phone.dto';
import { UnlinkIdentityDto } from './dto/unlink-identity.dto';
import { OAuthService } from './oauth.service';
import { AccountAuthService } from './account-auth.service';
import { AccountLoginDto } from './dto/account-login.dto';
import { PasswordForgotDto } from './dto/password-forgot.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { PasswordChangeDto } from './dto/password-change.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { ProfileService } from './profile.service';
import { CurrentPasswordChangeDto } from './dto/current-password-change.dto';
import { WechatMiniProgramPhoneLoginDto } from './dto/wechat-mini-program-phone-login.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { AllowPasswordChangeRequired } from '../../common/auth/allow-password-change-required.decorator';

type AuthRequest = {
  ip?: string;
  headers?: { [key: string]: string | string[] | undefined };
  cookies?: { refresh_token?: string };
  protocol?: string;
  socket?: { encrypted?: boolean };
};

type AuthResponse = {
  cookie(name: string, value: string, options: object): void;
  clearCookie(name: string, options: object): void;
};

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly verification: VerificationService,
    private readonly sessions: SessionService,
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
    private readonly accountAuth: AccountAuthService,
    private readonly profile: ProfileService,
  ) {}

  @ApiOperation({ summary: 'Send a phone verification code' })
  @Post('codes')
  async sendCode(@Body() body: SendCodeDto, @Req() request: AuthRequest) {
    return this.verification.issue({
      purpose: body.purpose,
      phone: body.phone,
      ip: request.ip ?? 'unknown',
      deviceId: body.deviceId,
    });
  }

  @ApiOperation({ summary: 'Sign in with a verified phone number' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('phone/login')
  async phoneLogin(
    @Body() body: PhoneLoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    const issued = await this.auth.phoneLogin(body, requestContext(request));
    return this.respondWithRefresh(response, issued);
  }

  @ApiOperation({ summary: 'Sign in with WeChat mini-program phone authorization' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('wechat/miniapp/phone-login')
  async wechatMiniProgramPhoneLogin(
    @Body() body: WechatMiniProgramPhoneLoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    const issued = await this.oauth.miniProgramPhoneLogin({
      ...body,
      ip: request.ip,
      device: deviceId(request),
    });
    return this.respondWithRefresh(response, issued);
  }

  @ApiOperation({ summary: 'Sign in with an administrator or merchant account password' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('account/login')
  async accountLogin(
    @Body() body: AccountLoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    const issued = await this.accountAuth.login(body, requestContext(request));
    return this.respondWithRefresh(response, issued);
  }

  @ApiOperation({ summary: 'Request a merchant password reset verification code' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  async forgotPassword(@Body() body: PasswordForgotDto, @Req() request: AuthRequest) {
    return this.accountAuth.requestPasswordReset(body, requestContext(request));
  }

  @ApiOperation({ summary: 'Reset a merchant password with a verification code' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  async resetPassword(@Body() body: PasswordResetDto, @Req() request: AuthRequest) {
    await this.accountAuth.resetPassword(body, requestContext(request));
    return { ok: true };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current account password' })
  @UseGuards(AccessTokenGuard)
  @AllowPasswordChangeRequired()
  @Post('account/password-change')
  async changeCurrentPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CurrentPasswordChangeDto,
    @Req() request: AuthRequest,
  ) {
    await this.accountAuth.changeCurrentPassword(user, body, requestContext(request));
    return { ok: true };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a verification code to change the current merchant password' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @AllowPasswordChangeRequired()
  @Post('password/change/code')
  async requestPasswordChangeCode(@CurrentUser() user: AuthenticatedUser, @Req() request: AuthRequest) {
    return this.accountAuth.requestPasswordChangeCode(user, requestContext(request));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current merchant password with a verification code' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @AllowPasswordChangeRequired()
  @Post('password/change')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PasswordChangeDto,
    @Req() request: AuthRequest,
  ) {
    await this.accountAuth.changePassword(user, body, requestContext(request));
    return { ok: true };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the current user nickname' })
  @UseGuards(AccessTokenGuard)
  @Patch('profile/nickname')
  async updateNickname(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateNicknameDto) {
    return this.profile.setNickname(user.userId, body.nickname);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current customer profile' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profile.get(user.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload the current customer avatar' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 512 * 1024 } }))
  @Post('profile/avatar')
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    return this.profile.setAvatar(user.userId, file);
  }

  @ApiOperation({ summary: 'Start a user OAuth authorization flow' })
  @Get('oauth/:provider/start')
  async oauthStart(
    @Param('provider') provider: string,
    @Query('audience') audience: string | undefined,
    @Req() request: AuthRequest,
  ) {
    const started = await this.oauth.start({ provider, audience: audience ?? 'user-api', ip: request.ip, device: deviceId(request) });
    return { authorization_url: started.authorizationUrl };
  }

  @ApiOperation({ summary: 'Exchange an OAuth code for a pending phone binding' })
  @Post('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: string,
    @Body() body: OAuthCallbackDto,
    @Req() request: AuthRequest,
  ) {
    const pending = await this.oauth.callback({ ...body, provider, ip: request.ip, device: deviceId(request) });
    return { pending_oauth_id: pending.pendingOauthId, expires_in: pending.expiresIn };
  }

  @ApiOperation({ summary: 'Exchange a mini-program uni.login code for a pending phone binding' })
  @Post('oauth/:provider/miniapp/callback')
  async miniProgramOauthCallback(
    @Param('provider') provider: string,
    @Body() body: MiniProgramOAuthCallbackDto,
    @Req() request: AuthRequest,
  ) {
    const pending = await this.oauth.miniProgramCallback({ ...body, provider, ip: request.ip, device: deviceId(request) });
    return { pending_oauth_id: pending.pendingOauthId, expires_in: pending.expiresIn };
  }

  @ApiOperation({ summary: 'Complete a pending OAuth binding with a verified phone number' })
  @Post('oauth/link-phone')
  async linkPhone(
    @Body() body: CompleteOAuthLoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    const issued = await this.oauth.linkPhone({
      ...body,
      ip: request.ip,
      device: deviceId(request),
    });
    return this.respondWithRefresh(response, issued);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bind a pending OAuth identity to the authenticated user' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Post('identities/:provider/bind')
  async bindIdentity(@Param('provider') provider: string, @Body() body: LinkPhoneDto, @CurrentUser() user: AuthenticatedUser) {
    await this.oauth.bindPendingIdentity({ ...body, provider, userId: user.userId });
    return { ok: true };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink an identity after recent phone verification' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @HttpCode(204)
  @Delete('identities/:identityId')
  async unlinkIdentity(@Param('identityId') identityId: string, @Body() body: UnlinkIdentityDto, @CurrentUser() user: AuthenticatedUser) {
    await this.oauth.unlinkIdentity({ ...body, identityId, userId: user.userId });
  }

  @ApiOperation({ summary: 'Refresh the current browser session' })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Body() _body: RefreshDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('Refresh token cookie is required.');
    const issued = await this.sessions.refresh(refreshToken, requestContext(request));
    return this.respondWithRefresh(response, issued);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated session user' })
  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out the current session' })
  @UseGuards(AccessTokenGuard)
  @AllowPasswordChangeRequired()
  @HttpCode(204)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    await this.sessions.revoke(user.sessionId, requestContext(request));
    response.clearCookie('refresh_token', refreshCookieOptions(this.config));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out every session for the current user' })
  @UseGuards(AccessTokenGuard)
  @AllowPasswordChangeRequired()
  @HttpCode(204)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    await this.sessions.revokeAll(user.userId, requestContext(request));
    response.clearCookie('refresh_token', refreshCookieOptions(this.config));
  }

  private setRefreshCookie(response: AuthResponse, refreshToken: string): void {
    response.cookie('refresh_token', refreshToken, refreshCookieOptions(this.config));
  }

  private respondWithRefresh(response: AuthResponse, tokens: SessionTokens) {
    this.setRefreshCookie(response, tokens.refreshToken);
    return toAuthTokens(tokens);
  }
}

function deviceId(request: AuthRequest): string {
  const value = request.headers?.['x-device-id'];
  return typeof value === 'string' && value.length > 0
    ? value.slice(0, 128)
    : `anonymous-${createAnonymousDeviceKey(request)}`;
}

function createAnonymousDeviceKey(request: AuthRequest): string {
  const fingerprint = `${request.ip ?? 'unknown'}:${request.headers?.['user-agent'] ?? 'unknown'}`;
  return createHash('sha256').update(fingerprint).digest('base64url').slice(0, 32);
}

function requestContext(request: AuthRequest) {
  const device = deviceId(request);
  return { ip: request.ip, device, deviceId: device };
}

function toAuthTokens(tokens: SessionTokens) {
  return { access_token: tokens.accessToken, expires_in: tokens.expiresIn, user: tokens.user };
}
