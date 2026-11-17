CREATE INDEX `purchase_receipts_storeId_createdAt_idx` ON `purchase_receipts`(`storeId`, `createdAt`);
CREATE INDEX `purchase_receipt_lines_storeId_receiptId_idx` ON `purchase_receipt_lines`(`storeId`, `receiptId`);
