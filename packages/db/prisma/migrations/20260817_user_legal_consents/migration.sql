CREATE TABLE `user_legal_consents` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `documentType` ENUM('USER_AGREEMENT', 'PRIVACY_POLICY') NOT NULL,
  `version` VARCHAR(32) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip` VARCHAR(64) NULL,
  `device` VARCHAR(191) NULL,
  UNIQUE INDEX `user_legal_consents_userId_documentType_version_key` (`userId`, `documentType`, `version`),
  INDEX `user_legal_consents_userId_acceptedAt_idx` (`userId`, `acceptedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `user_legal_consents_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
