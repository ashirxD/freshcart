import { StockStatus, deriveStockStatus } from './stock-status.enum';

/**
 * These three rules decide whether a shopper can add something to their cart,
 * so the boundaries are pinned down explicitly rather than assumed.
 */
describe('deriveStockStatus', () => {
  it('reports OUT_OF_STOCK at zero', () => {
    expect(deriveStockStatus(0, 5)).toBe(StockStatus.OUT_OF_STOCK);
  });

  it('reports OUT_OF_STOCK for a negative quantity', () => {
    // Should be unreachable (the schema floors at 0), but availability must
    // never read as "in stock" if it ever happens.
    expect(deriveStockStatus(-3, 5)).toBe(StockStatus.OUT_OF_STOCK);
  });

  it('reports LOW_STOCK exactly at the threshold', () => {
    expect(deriveStockStatus(5, 5)).toBe(StockStatus.LOW_STOCK);
  });

  it('reports LOW_STOCK below the threshold', () => {
    expect(deriveStockStatus(1, 5)).toBe(StockStatus.LOW_STOCK);
  });

  it('reports IN_STOCK one above the threshold', () => {
    expect(deriveStockStatus(6, 5)).toBe(StockStatus.IN_STOCK);
  });

  it('treats a zero threshold as "low stock never applies"', () => {
    expect(deriveStockStatus(1, 0)).toBe(StockStatus.IN_STOCK);
    expect(deriveStockStatus(0, 0)).toBe(StockStatus.OUT_OF_STOCK);
  });
});
