-- Extend the already-deployed authentication schema for account credentials.
-- Apply only after 20260711_add_authentication.

ALTER TABLE `auth_identities`
  MODIFY `provider` ENUM('PHONE', 'WECHAT', 'QQ', 'ACCOUNT') NOT NULL,
  ADD COLUMN `accountName` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `auth_identities_accountName_key`(`accountName`);

ALTER TABLE `auth_identities`
  ADD CONSTRAINT `auth_identities_account_name_check`
    CHECK (
      (`provider` <> 'ACCOUNT') OR (
        `accountName` IS NOT NULL AND
        BINARY `accountName` = BINARY `subject` AND
        BINARY `accountName` = BINARY LOWER(TRIM(`accountName`))
      )
    );

ALTER TABLE `user_roles`
  MODIFY `role` ENUM('USER', 'ADMIN', 'SUPER_ADMIN', 'MERCHANT') NOT NULL;

ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_merchant_store_scope_check`
    CHECK ((`role` <> 'MERCHANT') OR (`scopeType` = 'STORE' AND `scopeId` <> ''));

ALTER TABLE `auth_sessions`
  MODIFY `audience` ENUM('USER_API', 'ADMIN_API', 'MERCHANT_API') NOT NULL;

ALTER TABLE `verification_codes`
  MODIFY `purpose` ENUM('PHONE_LOGIN', 'PHONE_LINK', 'ADMIN_LOGIN', 'PASSWORD_RESET') NOT NULL;

ALTER TABLE `pending_oauth`
  MODIFY `provider` ENUM('PHONE', 'WECHAT', 'QQ', 'ACCOUNT') NOT NULL,
  MODIFY `audience` ENUM('USER_API', 'ADMIN_API', 'MERCHANT_API') NOT NULL;

ALTER TABLE `users`
  ADD COLUMN `nickname` VARCHAR(32) NULL;

CREATE TABLE `password_credentials` (
  `id` VARCHAR(191) NOT NULL,
  `identityId` VARCHAR(191) NOT NULL,
  `passwordHash` TEXT NOT NULL,
  `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `password_credentials_identityId_key`(`identityId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `password_credentials_identityId_fkey`
    FOREIGN KEY (`identityId`) REFERENCES `auth_identities`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
