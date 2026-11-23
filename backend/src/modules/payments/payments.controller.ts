import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentProvider } from '@lingdian/db';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { UpsertPaymentAccountDto } from './dto/upsert-payment-account.dto';
import { PaymentsService } from './payments.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly merchantStores: MerchantStoreScope,
  ) {}

  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Get('customer/payment-methods')
  paymentMethods(@Query('storeId') storeId?: string) {
    return this.payments.getCustomerPaymentMethods(storeId);
  }

  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Get('customer/orders/:orderId/wechat-payment')
  getWechatPayment(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.getActiveWechatPayment(orderId, user.userId);
  }

  @ApiOperation({ summary: 'Create an idempotent payment intent for an owned order' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Post('customer/orders/:orderId/payments')
  createIntent(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser, @Body() body: CreatePaymentIntentDto) {
    return this.payments.createIntent(orderId, user.userId, body);
  }

  @ApiOperation({ summary: 'Get an owned payment intent' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Get('customer/payments/:paymentNo')
  getIntent(@Param('paymentNo') paymentNo: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.getCustomerIntent(paymentNo, user.userId);
  }

  @ApiOperation({ summary: 'Recheck an expired payment intent for its owner' })
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Post('customer/payments/:paymentNo/recheck')
  recheckIntent(@Param('paymentNo') paymentNo: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.recheckCustomerIntent(paymentNo, user.userId);
  }

  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Header('Cache-Control', 'no-store')
  @Get('merchant/orders/:orderId/wechat-native-payment')
  getMerchantNativePayment(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId?: string) {
    return this.payments.getMerchantWechatNativePayment(orderId, this.merchantStores.forRequest(user, storeId));
  }

  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Header('Cache-Control', 'no-store')
  @Post('merchant/orders/:orderId/wechat-native-payment')
  createMerchantNativePayment(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId?: string) {
    return this.payments.createMerchantWechatNativePayment(orderId, this.merchantStores.forRequest(user, storeId));
  }

  @HttpCode(204)
  @Post('payments/wechat-native/webhooks/:accountId')
  async wechatNativeWebhook(
    @Param('accountId') accountId: string,
    @Req() request: { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    if (!request.rawBody) throw new Error('Raw request body is unavailable');
    await this.payments.handleWebhook('WECHAT_PAY', accountId, request.rawBody, headers, true);
  }

  @ApiOperation({ summary: 'Receive a signed event from a payment connector' })
  @Post('payments/webhooks/:provider/:accountId')
  webhook(
    @Param('provider') provider: PaymentProvider,
    @Param('accountId') accountId: string,
    @Req() request: { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    if (!request.rawBody) throw new Error('Raw request body is unavailable');
    return this.payments.handleWebhook(provider, accountId, request.rawBody, headers);
  }

  @ApiOperation({ summary: 'Create or update a store receiving account (credentials stay outside the database)' })
  @UseGuards(AccessTokenGuard, SuperAdminGuard)
  @Put('payment-accounts')
  upsertAccount(@Body() body: UpsertPaymentAccountDto) {
    return this.payments.upsertAccount(body);
  }

  @ApiOperation({ summary: 'List all store receiving accounts' })
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Get('payment-accounts')
  listAccounts() { return this.payments.listAccounts(); }

  @ApiOperation({ summary: 'List receiving accounts in the merchant store scope' })
  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('merchant/payment-accounts')
  listMerchantAccounts(@CurrentUser() user: AuthenticatedUser, @Headers('x-store-id') storeId?: string) {
    return this.payments.listAccounts(this.merchantStores.forRequest(user, storeId));
  }
}
