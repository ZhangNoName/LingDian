-- Deploy authentication models to an existing LingDian MySQL database.
-- Apply only via `prisma migrate deploy`; do not use `db push` in production.
CREATE TABLE `users` (
  `id` VARCHAR(191) NOT NULL,
  `status` ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `sessionVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_identities` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `provider` ENUM('PHONE','WECHAT','QQ') NOT NULL, `subject` VARCHAR(191) NOT NULL,
  `phoneE164` VARCHAR(191) NULL, `verifiedAt` DATETIME(3) NULL,
  UNIQUE INDEX `auth_identities_provider_subject_key`(`provider`, `subject`),
  UNIQUE INDEX `auth_identities_phoneE164_key`(`phoneE164`), INDEX `auth_identities_userId_idx`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `auth_identities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_roles` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('USER','ADMIN') NOT NULL, `scopeType` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL', `scopeId` VARCHAR(191) NOT NULL DEFAULT '',
  `status` ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE', `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `user_roles_userId_role_scopeType_scopeId_key`(`userId`,`role`,`scopeType`,`scopeId`), INDEX `user_roles_userId_status_idx`(`userId`,`status`),
  PRIMARY KEY (`id`), CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_sessions` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `audience` ENUM('USER_API','ADMIN_API') NOT NULL,
  `refreshTokenHash` VARCHAR(191) NOT NULL, `previousRefreshTokenHash` VARCHAR(191) NULL, `refreshTokenHistory` JSON NULL, `device` VARCHAR(191) NOT NULL,
  `status` ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE', `expiresAt` DATETIME(3) NOT NULL, `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `auth_sessions_refreshTokenHash_key`(`refreshTokenHash`), UNIQUE INDEX `auth_sessions_previousRefreshTokenHash_key`(`previousRefreshTokenHash`),
  UNIQUE INDEX `auth_sessions_userId_audience_device_key`(`userId`,`audience`,`device`), INDEX `auth_sessions_userId_status_idx`(`userId`,`status`), INDEX `auth_sessions_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`), CONSTRAINT `auth_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `verification_codes` (
  `id` VARCHAR(191) NOT NULL, `purpose` ENUM('PHONE_LOGIN','PHONE_LINK','ADMIN_LOGIN') NOT NULL, `targetHash` VARCHAR(191) NOT NULL, `codeHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL, `consumedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `verification_codes_purpose_targetHash_expiresAt_idx`(`purpose`,`targetHash`,`expiresAt`), INDEX `verification_codes_expiresAt_idx`(`expiresAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pending_oauth` (
  `id` VARCHAR(191) NOT NULL, `provider` ENUM('PHONE','WECHAT','QQ') NOT NULL, `subject` VARCHAR(191) NOT NULL, `stateHash` VARCHAR(191) NOT NULL,
  `audience` ENUM('USER_API','ADMIN_API') NOT NULL, `providerMetadataEncrypted` TEXT NOT NULL, `expiresAt` DATETIME(3) NOT NULL, `consumedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `pending_oauth_stateHash_key`(`stateHash`), INDEX `pending_oauth_provider_subject_idx`(`provider`,`subject`), INDEX `pending_oauth_expiresAt_idx`(`expiresAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_audit_logs` (
  `id` VARCHAR(191) NOT NULL, `event` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NULL, `sessionId` VARCHAR(191) NULL,
  `ip` VARCHAR(191) NULL, `device` VARCHAR(191) NULL, `metadata` JSON NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `auth_audit_logs_userId_createdAt_idx`(`userId`,`createdAt`), INDEX `auth_audit_logs_sessionId_createdAt_idx`(`sessionId`,`createdAt`), INDEX `auth_audit_logs_event_createdAt_idx`(`event`,`createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
