CREATE TABLE `mobile_inbox_reads` (
    `userId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(64) NOT NULL,
    `eventId` VARCHAR(64) NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`userId`, `scope`, `eventId`),
    CONSTRAINT `mobile_inbox_reads_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `inventory_alerts_store_detected_idx` ON `inventory_alerts` (`storeId`, `detectedAt`);
CREATE INDEX `order_status_logs_created_order_idx` ON `order_status_logs` (`createdAt`, `orderId`);
