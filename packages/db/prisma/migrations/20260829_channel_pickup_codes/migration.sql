-- Pickup codes are allocated independently for each store, Shanghai business date, and order source.
-- Existing orders deliberately keep pickupCode/pickupBusinessDate NULL: deriving a code from an old
-- order number could create a pickup credential that was never shown to the customer.
ALTER TABLE `orders`
  ADD COLUMN `orderSource` ENUM('MINIAPP', 'MEITUAN_WAIMAI', 'JD_DAOJIA', 'POS', 'MANUAL') NOT NULL DEFAULT 'MINIAPP',
  ADD COLUMN `pickupCode` VARCHAR(16) NULL,
  ADD COLUMN `pickupBusinessDate` DATE NULL;

CREATE UNIQUE INDEX `orders_storeId_pickupBusinessDate_pickupCode_key`
  ON `orders` (`storeId`, `pickupBusinessDate`, `pickupCode`);

CREATE TABLE `pickup_code_sequences` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `businessDate` DATE NOT NULL,
  `orderSource` ENUM('MINIAPP', 'MEITUAN_WAIMAI', 'JD_DAOJIA', 'POS', 'MANUAL') NOT NULL,
  `lastValue` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `pickup_code_sequences_storeId_businessDate_orderSource_key`
    (`storeId`, `businessDate`, `orderSource`),
  PRIMARY KEY (`id`),
  CONSTRAINT `pickup_code_sequences_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
