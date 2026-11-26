CREATE TABLE `order_pickup_notifications` (
  `orderId` VARCHAR(191) NOT NULL,
  `customerUserId` VARCHAR(191) NOT NULL,
  `recipientOpenId` VARCHAR(128) NOT NULL,
  `templateId` VARCHAR(128) NOT NULL,
  `status` ENUM('SUBSCRIBED', 'PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED', 'UNKNOWN') NOT NULL DEFAULT 'SUBSCRIBED',
  `readyAt` DATETIME(3) NULL,
  `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lockedAt` DATETIME(3) NULL,
  `lastErrorCode` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`orderId`),
  INDEX `order_pickup_notification_dispatch_idx` (`status`, `nextAttemptAt`),
  CONSTRAINT `order_pickup_notifications_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
