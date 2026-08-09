ALTER TABLE `users`
  ADD COLUMN `avatarData` MEDIUMBLOB NULL,
  ADD COLUMN `avatarMimeType` VARCHAR(32) NULL;

ALTER TABLE `orders`
  ADD COLUMN `deliveryAddress` TEXT NULL;

CREATE TABLE `user_addresses` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `recipientName` VARCHAR(64) NOT NULL,
  `phoneNumber` VARCHAR(32) NOT NULL,
  `provinceName` VARCHAR(64) NOT NULL,
  `cityName` VARCHAR(64) NOT NULL,
  `countyName` VARCHAR(64) NOT NULL,
  `streetName` VARCHAR(128) NOT NULL,
  `detailInfo` VARCHAR(255) NOT NULL,
  `postalCode` VARCHAR(16) NOT NULL DEFAULT '',
  `nationalCode` VARCHAR(16) NOT NULL DEFAULT '',
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `user_addresses_userId_isDefault_idx` (`userId`, `isDefault`),
  INDEX `user_addresses_userId_updatedAt_idx` (`userId`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `user_addresses_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
