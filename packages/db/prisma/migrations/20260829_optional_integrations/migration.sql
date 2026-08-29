-- Optional connector configuration is store-scoped; credentials remain in the deployment secret store.
CREATE TABLE `store_integrations` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `provider` ENUM('CASHIER', 'RECEIPT_PRINTER', 'MEITUAN_WAIMAI', 'JD_DAOJIA') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `store_integrations_storeId_provider_key`(`storeId`, `provider`),
    INDEX `store_integrations_provider_enabled_idx`(`provider`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `integration_outbox` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(64) NOT NULL,
    `provider` ENUM('CASHIER', 'RECEIPT_PRINTER', 'MEITUAN_WAIMAI', 'JD_DAOJIA') NOT NULL,
    `eventType` VARCHAR(64) NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `aggregateId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'DELIVERED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `lastError` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `integration_outbox_provider_eventId_key`(`provider`, `eventId`),
    INDEX `integration_outbox_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `integration_outbox_storeId_createdAt_idx`(`storeId`, `createdAt`),
    INDEX `integration_outbox_aggregateId_idx`(`aggregateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `store_integrations`
    ADD CONSTRAINT `store_integrations_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `integration_outbox`
    ADD CONSTRAINT `integration_outbox_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
