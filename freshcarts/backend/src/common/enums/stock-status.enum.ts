/**
 * Availability of a product at a store.
 *
 * Deliberately DERIVED from `quantity` and `lowStockThreshold` rather than
 * stored: a persisted copy would go stale the moment a stock write missed the
 * status update, and stale availability is worse than none.
 */
export enum StockStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

/** The single definition of the availability rules, used by every caller. */
export function deriveStockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
  if (quantity <= lowStockThreshold) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}
