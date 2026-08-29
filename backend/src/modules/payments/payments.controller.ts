import { Body, Controller, Get, Headers, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
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
  listMerchantAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.listAccounts(this.merchantStores.storeIds(user));
  }
}
