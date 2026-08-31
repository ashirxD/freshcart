import { MoneyError, assertMoney, lineTotal, orderTotal, sumMoney } from './money.util';

describe('money', () => {
  describe('assertMoney', () => {
    it('accepts whole rupees', () => {
      expect(assertMoney(340, 'price')).toBe(340);
      expect(assertMoney(0, 'discount')).toBe(0);
    });

    it('rejects a fractional amount rather than rounding it', () => {
      // Rounding here would silently put a wrong number on a real receipt.
      expect(() => assertMoney(340.5, 'price')).toThrow(MoneyError);
    });

    it('rejects a negative amount', () => {
      expect(() => assertMoney(-1, 'price')).toThrow(MoneyError);
    });
  });

  describe('lineTotal', () => {
    it('multiplies exactly', () => {
      expect(lineTotal(340, 2)).toBe(680);
    });

    it('rejects a fractional quantity', () => {
      expect(() => lineTotal(340, 1.5)).toThrow(MoneyError);
    });

    it('rejects a zero quantity — a line with none of something is not a line', () => {
      expect(() => lineTotal(340, 0)).toThrow(MoneyError);
    });
  });

  describe('sumMoney', () => {
    it('sums integers with no drift', () => {
      // The float equivalent of this basket (0.1-style values) is exactly the
      // case integer rupees exist to avoid.
      expect(sumMoney([340, 680, 1150, 3250, 99])).toBe(5519);
    });

    it('is zero for an empty basket', () => {
      expect(sumMoney([])).toBe(0);
    });
  });

  describe('orderTotal', () => {
    it('adds the delivery fee to the subtotal', () => {
      expect(orderTotal({ subtotal: 2500, deliveryFee: 120 })).toBe(2620);
    });

    it('subtracts a discount', () => {
      expect(orderTotal({ subtotal: 2500, deliveryFee: 120, discount: 200 })).toBe(2420);
    });

    it('treats a pickup order as a zero delivery fee, not a missing one', () => {
      expect(orderTotal({ subtotal: 2500, deliveryFee: 0 })).toBe(2500);
    });

    it('refuses a discount larger than the amount being discounted', () => {
      expect(() => orderTotal({ subtotal: 100, deliveryFee: 50, discount: 200 })).toThrow(
        MoneyError,
      );
    });
  });
});
