CREATE TABLE `inventory_material_changes` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `nameBefore` VARCHAR(120) NULL,
  `nameAfter` VARCHAR(120) NULL,
  `isActiveBefore` BOOLEAN NULL,
  `isActiveAfter` BOOLEAN NULL,
  `reason` VARCHAR(240) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `versionBefore` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `inventory_material_changes_history_idx` (`storeId`, `itemId`, `createdAt`, `id`),
  INDEX `inventory_material_changes_version_idx` (`storeId`, `itemId`, `versionBefore`),
  INDEX `inventory_material_changes_item_store_fkey` (`itemId`, `storeId`),
  CONSTRAINT `inventory_material_changes_item_store_fkey` FOREIGN KEY (`itemId`, `storeId`) REFERENCES `inventory_items` (`id`, `storeId`) ON DELETE RESTRICT ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve only validated legacy lifecycle facts. Never infer a missing historical operation.
-- Source audit rows remain unchanged, including malformed or unrelated records.
INSERT INTO `inventory_material_changes`
  (`id`, `storeId`, `itemId`, `kind`, `isActiveBefore`, `isActiveAfter`, `reason`, `actorId`, `versionBefore`, `createdAt`)
SELECT a.`id`, i.`storeId`, i.`id`,
  CASE WHEN a.`event` = 'INVENTORY_MATERIAL_ARCHIVED' THEN 'ARCHIVE' ELSE 'RESTORE' END,
  a.`event` = 'INVENTORY_MATERIAL_ARCHIVED',
  a.`event` = 'INVENTORY_MATERIAL_RESTORED',
  JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.reason')), a.`userId`,
  CASE WHEN JSON_TYPE(JSON_EXTRACT(a.`metadata`, '$.expectedVersion')) = 'INTEGER'
    AND CAST(JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.expectedVersion')) AS DECIMAL(65, 0)) BETWEEN 0 AND 2147483646
    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.expectedVersion')) AS SIGNED) ELSE NULL END,
  a.`createdAt`
FROM `auth_audit_logs` a
INNER JOIN `inventory_items` i
  ON i.`id` = JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.itemId'))
  AND i.`storeId` = JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.storeId'))
WHERE a.`event` IN ('INVENTORY_MATERIAL_ARCHIVED', 'INVENTORY_MATERIAL_RESTORED')
  AND JSON_TYPE(a.`metadata`) = 'OBJECT'
  AND JSON_TYPE(JSON_EXTRACT(a.`metadata`, '$.storeId')) = 'STRING'
  AND JSON_TYPE(JSON_EXTRACT(a.`metadata`, '$.itemId')) = 'STRING'
  AND JSON_TYPE(JSON_EXTRACT(a.`metadata`, '$.reason')) = 'STRING'
  AND CHAR_LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.reason')))) BETWEEN 1 AND 240
  AND CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.reason'))) <= 240
  AND JSON_TYPE(JSON_EXTRACT(a.`metadata`, '$.isActive')) = 'BOOLEAN'
  AND JSON_UNQUOTE(JSON_EXTRACT(a.`metadata`, '$.isActive')) = CASE WHEN a.`event` = 'INVENTORY_MATERIAL_ARCHIVED' THEN 'false' ELSE 'true' END;
