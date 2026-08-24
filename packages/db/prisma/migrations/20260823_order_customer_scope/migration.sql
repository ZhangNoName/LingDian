ALTER TABLE `orders`
  ADD COLUMN `customerUserId` VARCHAR(191) NULL,
  ADD COLUMN `clientRequestId` VARCHAR(64) NULL;

CREATE INDEX `orders_customerUserId_createdAt_idx`
  ON `orders` (`customerUserId`, `createdAt`);

CREATE UNIQUE INDEX `orders_customerUserId_clientRequestId_key`
  ON `orders` (`customerUserId`, `clientRequestId`);

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_customerUserId_fkey`
    FOREIGN KEY (`customerUserId`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
