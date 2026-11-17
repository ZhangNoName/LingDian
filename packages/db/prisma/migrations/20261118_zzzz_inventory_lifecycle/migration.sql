ALTER TABLE `inventory_items`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `lifecycleVersion` INTEGER NULL,
  ADD COLUMN `lifecycleActorId` VARCHAR(191) NULL,
  ADD COLUMN `lifecycleReason` VARCHAR(240) NULL,
  ADD COLUMN `lifecycleChangedAt` DATETIME(3) NULL;
CREATE INDEX `inventory_items_storeId_isActive_updatedAt_idx` ON `inventory_items`(`storeId`, `isActive`, `updatedAt`);
ALTER TABLE `inventory_alerts` ADD COLUMN `resolutionReason` VARCHAR(16) NULL;
UPDATE `inventory_alerts` SET `resolutionReason` = 'RECOVERED' WHERE `status` = 'RESOLVED';
