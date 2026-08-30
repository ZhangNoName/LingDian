-- MySQL DDL is not transactional. Detect ambiguous payment facts before any
-- permanent schema change so a conflict cannot leave this migration half
-- applied. If this insert reports a duplicate key, reconcile the provider
-- facts for that order and move all but the legitimate live attempt to a
-- terminal status before retrying `pnpm --filter @lingdian/db migrate:deploy`.
CREATE TEMPORARY TABLE `_migration_active_payment_order_keys` (
  `orderId` VARCHAR(191) NOT NULL PRIMARY KEY
);
INSERT INTO `_migration_active_payment_order_keys` (`orderId`)
SELECT `orderId`
FROM `payment_intents`
WHERE `status` IN ('CREATED', 'PENDING', 'PROCESSING');
DROP TEMPORARY TABLE `_migration_active_payment_order_keys`;

-- A provider transaction is a global money fact for one receiving account,
-- not an identifier local to a LingDian intent. Abort before permanent DDL if
-- legacy rows would assign the same fact to multiple intents.
CREATE TEMPORARY TABLE `_migration_provider_transaction_keys` (
  `provider` ENUM('WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL') NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `providerTransactionId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`provider`, `accountId`, `providerTransactionId`)
);
INSERT INTO `_migration_provider_transaction_keys`
  (`provider`, `accountId`, `providerTransactionId`)
SELECT
  `intent`.`provider`,
  `intent`.`accountId`,
  `transaction`.`providerTransactionId`
FROM `payment_transactions` AS `transaction`
INNER JOIN `payment_intents` AS `intent`
  ON `intent`.`id` = `transaction`.`paymentIntentId`
WHERE `transaction`.`providerTransactionId` IS NOT NULL;
DROP TEMPORARY TABLE `_migration_provider_transaction_keys`;

-- A login must receive a fresh session id. Reusing the unique per-device row
-- could reactivate access tokens that had already been revoked on logout.
DROP INDEX `auth_sessions_userId_audience_device_key` ON `auth_sessions`;
CREATE INDEX `auth_sessions_userId_audience_device_status_idx`
  ON `auth_sessions` (`userId`, `audience`, `device`, `status`);

ALTER TABLE `auth_sessions`
  ADD COLUMN `activeDeviceKey` CHAR(64) NULL;

-- The old schema's unique (user, audience, device) key normally makes this a
-- no-op. It also gives manually altered legacy databases a safe upgrade path:
-- retain only the newest active session and revoke older duplicates.
UPDATE `auth_sessions` AS `session`
INNER JOIN (
  SELECT `ranked`.`id`
  FROM (
    SELECT
      `id`,
      ROW_NUMBER() OVER (
        PARTITION BY `userId`, `audience`, `device`
        ORDER BY `createdAt` DESC, `id` DESC
      ) AS `activeRank`
    FROM `auth_sessions`
    WHERE `status` = 'ACTIVE'
  ) AS `ranked`
  WHERE `ranked`.`activeRank` > 1
) AS `duplicate` ON `duplicate`.`id` = `session`.`id`
SET
  `session`.`status` = 'REVOKED',
  `session`.`revokedAt` = COALESCE(`session`.`revokedAt`, CURRENT_TIMESTAMP(3));

UPDATE `auth_sessions`
SET `activeDeviceKey` = SHA2(CONCAT(`userId`, CHAR(0), `audience`, CHAR(0), `device`), 256)
WHERE `status` = 'ACTIVE';

CREATE UNIQUE INDEX `auth_sessions_activeDeviceKey_key`
  ON `auth_sessions` (`activeDeviceKey`);

-- Nullable unique keys let the database express the invariant that one order
-- has at most one in-progress provider attempt. Terminal attempts release it.
ALTER TABLE `payment_intents`
  ADD COLUMN `activeOrderKey` VARCHAR(191) NULL;

UPDATE `payment_intents`
SET `activeOrderKey` = `orderId`
WHERE `status` IN ('CREATED', 'PENDING', 'PROCESSING');

CREATE UNIQUE INDEX `payment_intents_activeOrderKey_key`
  ON `payment_intents` (`activeOrderKey`);

-- Denormalize the immutable provider/account scope onto each transaction so
-- the database can prevent one real provider transaction from crediting two
-- local payment intents, including under concurrent webhook delivery.
ALTER TABLE `payment_transactions`
  ADD COLUMN `provider` ENUM('WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL') NULL,
  ADD COLUMN `accountId` VARCHAR(191) NULL;

UPDATE `payment_transactions` AS `transaction`
INNER JOIN `payment_intents` AS `intent`
  ON `intent`.`id` = `transaction`.`paymentIntentId`
SET
  `transaction`.`provider` = `intent`.`provider`,
  `transaction`.`accountId` = `intent`.`accountId`;

ALTER TABLE `payment_transactions`
  MODIFY `provider` ENUM('WECHAT_PAY', 'ALIPAY', 'UNIONPAY', 'STRIPE', 'PAYPAL') NOT NULL,
  MODIFY `accountId` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `payment_transactions_provider_accountId_providerTransactionId_key`
  ON `payment_transactions` (`provider`, `accountId`, `providerTransactionId`);
CREATE INDEX `payment_transactions_accountId_fkey`
  ON `payment_transactions` (`accountId`);
ALTER TABLE `payment_transactions`
  ADD CONSTRAINT `payment_transactions_accountId_fkey`
  FOREIGN KEY (`accountId`) REFERENCES `payment_accounts` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
