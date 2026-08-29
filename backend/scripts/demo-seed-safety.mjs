const ALLOWED_DEMO_SEED_ENVIRONMENTS = new Set(['development', 'test']);

export function assertDemoSeedAllowed(env = process.env) {
  if (!ALLOWED_DEMO_SEED_ENVIRONMENTS.has(env.NODE_ENV)) {
    throw new Error(
      'The destructive demo seed requires NODE_ENV=development or NODE_ENV=test.',
    );
  }
  if (env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('The destructive demo seed requires ALLOW_DEMO_SEED=true.');
  }
}

export async function clearPrimaryStoreDemoData(tx, primaryStoreId) {
  const orderStoreWhere = { order: { storeId: primaryStoreId } };

  // Payment and integration records must be removed before their restricted
  // order relations. Receiving accounts and connector switches are configuration
  // and deliberately survive a demo-data reset.
  await tx.paymentTransaction.deleteMany({
    where: { paymentIntent: orderStoreWhere },
  });
  await tx.paymentWebhookEvent.deleteMany({
    where: { account: { storeId: primaryStoreId } },
  });
  await tx.paymentIntent.deleteMany({ where: orderStoreWhere });
  await tx.integrationOutbox.deleteMany({ where: { storeId: primaryStoreId } });

  await tx.orderStatusLog.deleteMany({ where: orderStoreWhere });
  await tx.orderItemSelection.deleteMany({
    where: { orderItem: orderStoreWhere },
  });
  await tx.orderItem.deleteMany({ where: orderStoreWhere });
  await tx.order.deleteMany({ where: { storeId: primaryStoreId } });

  await tx.productSelectionGroup.deleteMany({
    where: { group: { storeId: primaryStoreId } },
  });
  await tx.selectionOption.deleteMany({
    where: { group: { storeId: primaryStoreId } },
  });
  await tx.selectionGroup.deleteMany({ where: { storeId: primaryStoreId } });
  await tx.productSKU.deleteMany({
    where: { product: { storeId: primaryStoreId } },
  });
  await tx.product.deleteMany({ where: { storeId: primaryStoreId } });
  await tx.category.deleteMany({ where: { storeId: primaryStoreId } });
}
