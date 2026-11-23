-- AlterTable
ALTER TABLE `inventory_movements` ADD COLUMN `purchaseReceiptId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `contact` VARCHAR(191) NOT NULL DEFAULT '',
    `note` VARCHAR(240) NOT NULL DEFAULT '',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `suppliers_storeId_isActive_name_idx`(`storeId`, `isActive`, `name`),
    UNIQUE INDEX `suppliers_id_storeId_key`(`id`, `storeId`),
    UNIQUE INDEX `suppliers_storeId_code_key`(`storeId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `supplierName` VARCHAR(120) NOT NULL,
    `supplierCode` VARCHAR(64) NOT NULL,
    `orderNo` VARCHAR(40) NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    `version` INTEGER NOT NULL DEFAULT 0,
    `totalCostCents` BIGINT NOT NULL,
    `receivedCostCents` BIGINT NOT NULL DEFAULT 0,
    `expectedAt` DATETIME(3) NULL,
    `note` VARCHAR(240) NOT NULL DEFAULT '',
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(240) NULL,

    INDEX `purchase_orders_supplierId_storeId_idx`(`supplierId`, `storeId`),
    INDEX `purchase_orders_storeId_status_createdAt_idx`(`storeId`, `status`, `createdAt`),
    UNIQUE INDEX `purchase_orders_id_storeId_key`(`id`, `storeId`),
    UNIQUE INDEX `purchase_orders_storeId_requestId_key`(`storeId`, `requestId`),
    UNIQUE INDEX `purchase_orders_storeId_orderNo_key`(`storeId`, `orderNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_lines` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `itemName` VARCHAR(120) NOT NULL,
    `itemCode` VARCHAR(64) NOT NULL,
    `unit` VARCHAR(16) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `receivedQuantity` INTEGER NOT NULL DEFAULT 0,
    `unitPriceCents` INTEGER NOT NULL,

    INDEX `purchase_order_lines_orderId_storeId_idx`(`orderId`, `storeId`),
    INDEX `purchase_order_lines_itemId_storeId_idx`(`itemId`, `storeId`),
    UNIQUE INDEX `purchase_order_lines_id_storeId_key`(`id`, `storeId`),
    UNIQUE INDEX `purchase_order_lines_orderId_itemId_key`(`orderId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_receipts` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `note` VARCHAR(240) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `totalCostCents` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchase_receipts_orderId_storeId_createdAt_idx`(`orderId`, `storeId`, `createdAt`),
    UNIQUE INDEX `purchase_receipts_id_storeId_key`(`id`, `storeId`),
    UNIQUE INDEX `purchase_receipts_storeId_requestId_key`(`storeId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_receipt_lines` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `receiptId` VARCHAR(191) NOT NULL,
    `orderLineId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `costCents` BIGINT NOT NULL,

    INDEX `purchase_receipt_lines_receiptId_storeId_idx`(`receiptId`, `storeId`),
    INDEX `purchase_receipt_lines_orderLineId_storeId_idx`(`orderLineId`, `storeId`),
    UNIQUE INDEX `purchase_receipt_lines_receiptId_orderLineId_key`(`receiptId`, `orderLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `inventory_movements_purchaseReceiptId_storeId_idx` ON `inventory_movements`(`purchaseReceiptId`, `storeId`);

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_purchaseReceiptId_storeId_fkey` FOREIGN KEY (`purchaseReceiptId`, `storeId`) REFERENCES `purchase_receipts`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplierId_storeId_fkey` FOREIGN KEY (`supplierId`, `storeId`) REFERENCES `suppliers`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_orderId_storeId_fkey` FOREIGN KEY (`orderId`, `storeId`) REFERENCES `purchase_orders`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `purchase_order_lines` ADD CONSTRAINT `purchase_order_lines_itemId_storeId_fkey` FOREIGN KEY (`itemId`, `storeId`) REFERENCES `inventory_items`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `purchase_receipts` ADD CONSTRAINT `purchase_receipts_orderId_storeId_fkey` FOREIGN KEY (`orderId`, `storeId`) REFERENCES `purchase_orders`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `purchase_receipt_lines` ADD CONSTRAINT `purchase_receipt_lines_receiptId_storeId_fkey` FOREIGN KEY (`receiptId`, `storeId`) REFERENCES `purchase_receipts`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `purchase_receipt_lines` ADD CONSTRAINT `purchase_receipt_lines_orderLineId_storeId_fkey` FOREIGN KEY (`orderLineId`, `storeId`) REFERENCES `purchase_order_lines`(`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
