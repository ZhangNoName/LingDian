CREATE TABLE `inventory_alerts` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `activeItemKey` VARCHAR(191) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  `severity` VARCHAR(8) NOT NULL,
  `availableAtTrigger` INTEGER NOT NULL,
  `thresholdAtTrigger` INTEGER NOT NULL,
  `availableLatest` INTEGER NOT NULL,
  `thresholdLatest` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `acknowledgedBy` VARCHAR(191) NULL,
  `note` VARCHAR(240) NULL,
  `resolvedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_alerts_activeItemKey_key` (`activeItemKey`),
  UNIQUE INDEX `inventory_alerts_id_storeId_key` (`id`, `storeId`),
  INDEX `inventory_alerts_storeId_status_detectedAt_idx` (`storeId`, `status`, `detectedAt`),
  CONSTRAINT `inventory_alerts_itemId_storeId_fkey` FOREIGN KEY (`itemId`, `storeId`) REFERENCES `inventory_items` (`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_alerts_state` CHECK (
    (`status` IN ('OPEN', 'ACKNOWLEDGED') AND `activeItemKey` = `itemId` AND `activeItemKey` IS NOT NULL AND `resolvedAt` IS NULL)
    OR (`status` = 'RESOLVED' AND `activeItemKey` IS NULL AND `resolvedAt` IS NOT NULL)
  ),
  CONSTRAINT `inventory_alerts_severity` CHECK (`severity` IN ('LOW', 'OUT'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Detect existing shortages now; do not invent an earlier trigger time.
INSERT INTO `inventory_alerts` (`id`, `storeId`, `itemId`, `activeItemKey`, `severity`, `availableAtTrigger`, `thresholdAtTrigger`, `availableLatest`, `thresholdLatest`, `updatedAt`)
SELECT CONCAT('alert_', UUID()), `storeId`, `id`, `id`, IF(`availableQuantity` = 0, 'OUT', 'LOW'), `availableQuantity`, `reorderPoint`, `availableQuantity`, `reorderPoint`, CURRENT_TIMESTAMP(3)
FROM `inventory_items` WHERE `availableQuantity` <= `reorderPoint`;
