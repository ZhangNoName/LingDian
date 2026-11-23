ALTER TABLE `inventory_items`
  ADD COLUMN `reservedQuantity` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `availableQuantity` INTEGER NOT NULL DEFAULT 0;
UPDATE `inventory_items` SET `availableQuantity` = `quantity`;
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_reservation_balance`
  CHECK (`reservedQuantity` >= 0 AND `reservedQuantity` <= `quantity` AND `availableQuantity` = `quantity` - `reservedQuantity`);
ALTER TABLE `inventory_movements`
  ADD COLUMN `reservedBefore` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `reservedAfter` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `product_skus` ADD COLUMN `recipeVersion` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN `stockExpiresAt` DATETIME(3) NULL;
CREATE UNIQUE INDEX `orders_id_storeId_key` ON `orders` (`id`, `storeId`);
CREATE INDEX `orders_status_stockExpiresAt_idx` ON `orders` (`status`, `stockExpiresAt`);
CREATE TABLE `inventory_recipes` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `skuId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_recipes_skuId_itemId_key` (`skuId`, `itemId`),
  INDEX `inventory_recipes_storeId_skuId_idx` (`storeId`, `skuId`),
  CONSTRAINT `inventory_recipes_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `product_skus` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_recipes_itemId_storeId_fkey` FOREIGN KEY (`itemId`, `storeId`) REFERENCES `inventory_items` (`id`, `storeId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_recipes_positive` CHECK (`quantity` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `inventory_reservations` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'RESERVED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_reservations_orderId_itemId_key` (`orderId`, `itemId`),
  INDEX `inventory_reservations_storeId_orderId_status_idx` (`storeId`, `orderId`, `status`),
  CONSTRAINT `inventory_reservations_orderId_storeId_fkey` FOREIGN KEY (`orderId`, `storeId`) REFERENCES `orders` (`id`, `storeId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_reservations_itemId_storeId_fkey` FOREIGN KEY (`itemId`, `storeId`) REFERENCES `inventory_items` (`id`, `storeId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_reservations_positive` CHECK (`quantity` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
