-- CreateTable
CREATE TABLE `product_image_requests` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `operation` VARCHAR(8) NOT NULL,
    `state` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `expectedVersion` INTEGER NOT NULL,
    `assetKey` VARCHAR(36) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_image_requests_assetKey_key`(`assetKey`),
    INDEX `product_image_requests_state_createdAt_idx`(`state`, `createdAt`),
    INDEX `product_image_requests_productId_storeId_idx`(`productId`, `storeId`),
    UNIQUE INDEX `product_image_requests_storeId_requestId_key`(`storeId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `products_id_storeId_key` ON `products`(`id`, `storeId`);

-- AddForeignKey
ALTER TABLE `product_image_requests` ADD CONSTRAINT `product_image_requests_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_image_requests` ADD CONSTRAINT `product_image_requests_productId_storeId_fkey` FOREIGN KEY (`productId`, `storeId`) REFERENCES `products`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
