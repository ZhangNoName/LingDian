import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { OrdersController } from './orders.controller';

test('order reads use audience-specific guards', () => {
  for (const endpoint of ['getOrders', 'getOrderDetail', 'getOrderSummary'] as const) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OrdersController.prototype[endpoint]) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(AdminGuard));
  }
  for (const endpoint of ['getCustomerOrders', 'getCustomerOrderDetail'] as const) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OrdersController.prototype[endpoint]) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(UserApiGuard));
  }
  for (const endpoint of ['getMerchantOrderSummary', 'getMerchantOrders', 'getMerchantOrderDetail', 'updateMerchantOrderStatus', 'deleteMerchantOrder'] as const) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OrdersController.prototype[endpoint]) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(MerchantGuard));
  }
});
