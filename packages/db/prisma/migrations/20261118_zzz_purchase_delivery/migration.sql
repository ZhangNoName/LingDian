-- Follow up active purchases by the recorded expected-delivery instant, including NULL dates.
CREATE INDEX `purchase_orders_storeId_status_expectedAt_idx` ON `purchase_orders`(`storeId`, `status`, `expectedAt`);
