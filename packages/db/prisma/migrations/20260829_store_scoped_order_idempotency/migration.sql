CREATE UNIQUE INDEX `orders_storeId_customerUserId_clientRequestId_key`
  ON `orders` (`storeId`, `customerUserId`, `clientRequestId`);

DROP INDEX `orders_customerUserId_clientRequestId_key` ON `orders`;
