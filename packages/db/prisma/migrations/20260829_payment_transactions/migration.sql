ALTER TABLE `orders`
  MODIFY COLUMN `paymentChannel` ENUM('CASH', 'WECHAT', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL', 'CUSTOMER_SCAN', 'OTHER') NOT NULL DEFAULT 'CASH';

CREATE TABLE `payment_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `provider` ENUM('WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL') NOT NULL,
  `channel` ENUM('CASH', 'WECHAT', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL', 'CUSTOMER_SCAN', 'OTHER') NOT NULL,
  `externalAccountId` VARCHAR(191) NOT NULL,
  `connectorConfigKey` VARCHAR(64) NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `payment_accounts_storeId_provider_channel_key` (`storeId`, `provider`, `channel`),
  INDEX `payment_accounts_provider_status_idx` (`provider`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_accounts_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_intents` (
  `id` VARCHAR(191) NOT NULL,
  `paymentNo` VARCHAR(64) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `provider` ENUM('WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL') NOT NULL,
  `channel` ENUM('CASH', 'WECHAT', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL', 'CUSTOMER_SCAN', 'OTHER') NOT NULL,
  `status` ENUM('CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'CREATED',
  `reconciliationStatus` ENUM('PENDING', 'MATCHED', 'LATE_PAYMENT', 'MANUAL_REVIEW') NOT NULL DEFAULT 'PENDING',
  `amountMinor` BIGINT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'CNY',
  `clientRequestId` VARCHAR(64) NOT NULL,
  `providerIntentId` VARCHAR(191) NULL,
  `clientAction` JSON NULL,
  `failureCode` VARCHAR(64) NULL,
  `failureMessage` VARCHAR(255) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `paidAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `payment_intents_paymentNo_key` (`paymentNo`),
  UNIQUE INDEX `payment_intents_orderId_clientRequestId_key` (`orderId`, `clientRequestId`),
  UNIQUE INDEX `payment_intents_provider_providerIntentId_key` (`provider`, `providerIntentId`),
  INDEX `payment_intents_orderId_createdAt_idx` (`orderId`, `createdAt`),
  INDEX `payment_intents_status_expiresAt_idx` (`status`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_intents_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payment_intents_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `payment_accounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_transactions` (
  `id` VARCHAR(191) NOT NULL,
  `transactionNo` VARCHAR(64) NOT NULL,
  `paymentIntentId` VARCHAR(191) NOT NULL,
  `type` ENUM('PAYMENT', 'REFUND', 'REVERSAL') NOT NULL,
  `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED') NOT NULL,
  `amountMinor` BIGINT NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `providerTransactionId` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `failureCode` VARCHAR(64) NULL,
  `occurredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `payment_transactions_transactionNo_key` (`transactionNo`),
  UNIQUE INDEX `payment_transactions_paymentIntentId_type_idempotencyKey_key` (`paymentIntentId`, `type`, `idempotencyKey`),
  UNIQUE INDEX `payment_transactions_paymentIntentId_providerTransactionId_key` (`paymentIntentId`, `providerTransactionId`),
  INDEX `payment_transactions_paymentIntentId_createdAt_idx` (`paymentIntentId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_transactions_paymentIntentId_fkey` FOREIGN KEY (`paymentIntentId`) REFERENCES `payment_intents` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_webhook_events` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL') NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(64) NOT NULL,
  `payloadHash` CHAR(64) NOT NULL,
  `signatureVerified` BOOLEAN NOT NULL DEFAULT false,
  `processedAt` DATETIME(3) NULL,
  `processingError` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `payment_webhook_events_provider_accountId_eventId_key` (`provider`, `accountId`, `eventId`),
  INDEX `payment_webhook_events_processedAt_createdAt_idx` (`processedAt`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_webhook_events_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `payment_accounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
