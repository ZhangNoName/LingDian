ALTER TABLE `products` ADD COLUMN `creationRequestId` VARCHAR(64) NULL, ADD COLUMN `creationFingerprint` CHAR(64) NULL, MODIFY `description` TEXT NULL;
CREATE UNIQUE INDEX `products_storeId_creationRequestId_key` ON `products`(`storeId`,`creationRequestId`);
