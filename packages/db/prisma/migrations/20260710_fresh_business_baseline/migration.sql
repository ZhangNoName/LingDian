-- Fresh-install baseline for the business tables that predate Prisma Migrate.
--
-- This migration intentionally describes the schema as it existed immediately
-- before 20260711_add_authentication. Later migrations remain the sole owners of
-- every subsequent column, index, and table. Established installations already
-- have these tables but do not have a migration record for this newly introduced
-- historical baseline. The checked-in safe deploy wrapper resolves this
-- migration only after validating that all
-- historical tables and columns are already present; never execute this SQL
-- directly against an established database.

CREATE TABLE `stores` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `contactName` VARCHAR(191) NULL,
  `contactPhone` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `businessHours` VARCHAR(191) NULL,
  `status` ENUM('OPEN', 'CLOSED', 'RESTING') NOT NULL DEFAULT 'OPEN',
  `dineInEnabled` BOOLEAN NOT NULL DEFAULT true,
  `takeoutEnabled` BOOLEAN NOT NULL DEFAULT true,
  `pickupEnabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `stores_code_key` (`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `categories` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isVisible` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `categories_storeId_sortOrder_idx` (`storeId`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `categories_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `imageUrl` VARCHAR(191) NULL,
  `type` ENUM('SINGLE', 'PACKAGE') NOT NULL DEFAULT 'SINGLE',
  `price` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'SOLD_OUT', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `isFeatured` BOOLEAN NOT NULL DEFAULT false,
  `stock` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `products_storeId_status_idx` (`storeId`, `status`),
  INDEX `products_categoryId_idx` (`categoryId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `products_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `products_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_skus` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `skuName` VARCHAR(191) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `stockCount` INTEGER NOT NULL DEFAULT 0,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `product_skus_productId_idx` (`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `product_skus_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `selection_groups` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `groupType` ENUM('MODIFIER', 'COMPONENT') NOT NULL,
  `selectionMode` ENUM('SINGLE', 'MULTIPLE') NOT NULL,
  `minSelect` INTEGER NOT NULL DEFAULT 0,
  `maxSelect` INTEGER NOT NULL DEFAULT 1,
  `isRequired` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `description` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `selection_groups_storeId_sortOrder_idx` (`storeId`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `selection_groups_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `selection_options` (
  `id` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `optionType` ENUM('VALUE', 'VARIANT') NOT NULL DEFAULT 'VALUE',
  `priceDelta` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `stockDelta` INTEGER NOT NULL DEFAULT 0,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `referencedSkuId` VARCHAR(191) NULL,
  `extraData` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `selection_options_groupId_sortOrder_idx` (`groupId`, `sortOrder`),
  INDEX `selection_options_referencedSkuId_idx` (`referencedSkuId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `selection_options_groupId_fkey`
    FOREIGN KEY (`groupId`) REFERENCES `selection_groups` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `selection_options_referencedSkuId_fkey`
    FOREIGN KEY (`referencedSkuId`) REFERENCES `product_skus` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_selection_groups` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NULL,
  `variantId` VARCHAR(191) NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `scope` ENUM('PRODUCT', 'VARIANT') NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `product_selection_groups_productId_sortOrder_idx` (`productId`, `sortOrder`),
  INDEX `product_selection_groups_variantId_sortOrder_idx` (`variantId`, `sortOrder`),
  INDEX `product_selection_groups_groupId_idx` (`groupId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `product_selection_groups_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_selection_groups_variantId_fkey`
    FOREIGN KEY (`variantId`) REFERENCES `product_skus` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_selection_groups_groupId_fkey`
    FOREIGN KEY (`groupId`) REFERENCES `selection_groups` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orders` (
  `id` VARCHAR(191) NOT NULL,
  `orderNo` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `customerMobile` VARCHAR(191) NOT NULL,
  `orderType` ENUM('DINE_IN', 'TAKEOUT', 'PICKUP') NOT NULL,
  `status` ENUM('CREATING', 'PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'TIMED_OUT', 'REFUNDING', 'REFUNDED', 'CANCELLED', 'FAILED', 'DELETED') NOT NULL DEFAULT 'CREATING',
  `paymentChannel` ENUM('CASH', 'WECHAT', 'ALIPAY', 'CUSTOMER_SCAN', 'OTHER') NOT NULL DEFAULT 'CASH',
  `totalAmount` DECIMAL(10, 2) NOT NULL,
  `payableAmount` DECIMAL(10, 2) NOT NULL,
  `remark` VARCHAR(191) NULL,
  `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  `deletedAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `refundingAt` DATETIME(3) NULL,
  `refundedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `orders_orderNo_key` (`orderNo`),
  INDEX `orders_storeId_createdAt_idx` (`storeId`, `createdAt`),
  INDEX `orders_status_idx` (`status`),
  INDEX `orders_isDeleted_createdAt_idx` (`isDeleted`, `createdAt`),
  INDEX `orders_storeId_status_isDeleted_idx` (`storeId`, `status`, `isDeleted`),
  PRIMARY KEY (`id`),
  CONSTRAINT `orders_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `stores` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_status_logs` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('CREATING', 'PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'TIMED_OUT', 'REFUNDING', 'REFUNDED', 'CANCELLED', 'FAILED', 'DELETED') NULL,
  `toStatus` ENUM('CREATING', 'PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'TIMED_OUT', 'REFUNDING', 'REFUNDED', 'CANCELLED', 'FAILED', 'DELETED') NOT NULL,
  `operatorName` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `extra` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `order_status_logs_orderId_createdAt_idx` (`orderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `order_status_logs_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `skuId` VARCHAR(191) NULL,
  `productName` VARCHAR(191) NOT NULL,
  `skuName` VARCHAR(191) NULL,
  `unitPrice` DECIMAL(10, 2) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `remark` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `order_items_orderId_idx` (`orderId`),
  INDEX `order_items_productId_idx` (`productId`),
  INDEX `order_items_skuId_idx` (`skuId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `order_items_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_items_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `order_items_skuId_fkey`
    FOREIGN KEY (`skuId`) REFERENCES `product_skus` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_item_selections` (
  `id` VARCHAR(191) NOT NULL,
  `orderItemId` VARCHAR(191) NOT NULL,
  `selectionGroupId` VARCHAR(191) NULL,
  `selectionOptionId` VARCHAR(191) NULL,
  `groupNameSnapshot` VARCHAR(191) NOT NULL,
  `optionNameSnapshot` VARCHAR(191) NOT NULL,
  `optionType` ENUM('VALUE', 'VARIANT') NOT NULL,
  `referencedSkuId` VARCHAR(191) NULL,
  `referencedSkuName` VARCHAR(191) NULL,
  `priceDelta` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `order_item_selections_orderItemId_idx` (`orderItemId`),
  INDEX `order_item_selections_selectionOptionId_idx` (`selectionOptionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `order_item_selections_orderItemId_fkey`
    FOREIGN KEY (`orderItemId`) REFERENCES `order_items` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_item_selections_selectionOptionId_fkey`
    FOREIGN KEY (`selectionOptionId`) REFERENCES `selection_options` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
