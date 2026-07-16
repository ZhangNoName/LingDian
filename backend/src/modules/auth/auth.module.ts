import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { SmsProviderModule } from './providers/sms-provider.module';
import { AuditService } from './audit.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AUTH_REFRESH_PEPPER, VerificationService } from './verification.service';
import { OAUTH_PROVIDERS } from './providers/oauth-provider';
import { WechatOAuthProvider } from './providers/wechat-oauth.provider';
import { QqOAuthProvider } from './providers/qq-oauth.provider';
import { OAuthService } from './oauth.service';
import { PasswordService } from './password.service';
import { AccountAuthService } from './account-auth.service';
import { MerchantAdminService } from './merchant-admin.service';
import { MerchantAdminController } from './merchant-admin.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    SmsProviderModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('auth.jwtAccessSecret') }),
    }),
  ],
  controllers: [AuthController, MerchantAdminController],
  providers: [
    {
      provide: AUTH_REFRESH_PEPPER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow<string>('auth.refreshPepper'),
    },
    AuditService,
    VerificationService,
    SessionService,
    PasswordService,
    AccountAuthService,
    MerchantAdminService,
    ProfileService,
    AuthService,
    WechatOAuthProvider,
    QqOAuthProvider,
    {
      provide: OAUTH_PROVIDERS,
      inject: [WechatOAuthProvider, QqOAuthProvider],
      useFactory: (wechat: WechatOAuthProvider, qq: QqOAuthProvider) => [wechat, qq],
    },
    OAuthService,
    AccessTokenGuard,
    AdminGuard,
    MerchantGuard,
    SuperAdminGuard,
    UserApiGuard,
  ],
  exports: [JwtModule, AuthService, VerificationService, SessionService, PasswordService, AccountAuthService, MerchantAdminService, ProfileService, OAuthService, AccessTokenGuard, AdminGuard, MerchantGuard, SuperAdminGuard, UserApiGuard],
})
export class AuthModule {}
