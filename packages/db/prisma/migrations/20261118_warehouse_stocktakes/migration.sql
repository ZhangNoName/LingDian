-- AlterTable
ALTER TABLE `inventory_movements` ADD COLUMN `stocktakeId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `inventory_stocktakes` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `note` VARCHAR(240) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `postedBy` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,

    INDEX `inventory_stocktakes_storeId_status_createdAt_idx`(`storeId`, `status`, `createdAt`),
    UNIQUE INDEX `inventory_stocktakes_id_storeId_key`(`id`, `storeId`),
    UNIQUE INDEX `inventory_stocktakes_storeId_requestId_key`(`storeId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_stocktake_lines` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `stocktakeId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `itemName` VARCHAR(120) NOT NULL,
    `itemCode` VARCHAR(64) NOT NULL,
    `unit` VARCHAR(16) NOT NULL,
    `expectedQuantity` INTEGER NOT NULL,
    `reservedQuantity` INTEGER NOT NULL,
    `itemVersion` INTEGER NOT NULL,
    `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `countedQuantity` INTEGER NULL,

    INDEX `inventory_stocktake_lines_stocktakeId_storeId_idx`(`stocktakeId`, `storeId`),
    INDEX `inventory_stocktake_lines_itemId_storeId_idx`(`itemId`, `storeId`),
    UNIQUE INDEX `inventory_stocktake_lines_stocktakeId_itemId_key`(`stocktakeId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `inventory_movements_stocktakeId_storeId_idx` ON `inventory_movements`(`stocktakeId`, `storeId`);

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_stocktakeId_storeId_fkey` FOREIGN KEY (`stocktakeId`, `storeId`) REFERENCES `inventory_stocktakes`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_stocktakes` ADD CONSTRAINT `inventory_stocktakes_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_stocktake_lines` ADD CONSTRAINT `inventory_stocktake_lines_stocktakeId_storeId_fkey` FOREIGN KEY (`stocktakeId`, `storeId`) REFERENCES `inventory_stocktakes`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_stocktake_lines` ADD CONSTRAINT `inventory_stocktake_lines_itemId_storeId_fkey` FOREIGN KEY (`itemId`, `storeId`) REFERENCES `inventory_items`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
