import { UnitType } from 'src/common/enums';
import { discountPercent, formatUnitLabel } from './product.view';

describe('discountPercent', () => {
  it('is zero when there is no compare-at price', () => {
    expect(discountPercent(340, null)).toBe(0);
  });

  it('is zero when the compare-at price is not actually higher', () => {
    // Guards against a mis-entered "discount" rendering as a saving.
    expect(discountPercent(340, 340)).toBe(0);
    expect(discountPercent(340, 300)).toBe(0);
  });

  it('computes the saving against the compare-at price', () => {
    expect(discountPercent(1450, 1600)).toBe(9);
    expect(discountPercent(220, 250)).toBe(12);
  });

  it('rounds to the nearest whole percent', () => {
    // 1150/1250 -> 8%, not 8.0000000001% or 7%.
    expect(discountPercent(1150, 1250)).toBe(8);
  });
});

describe('formatUnitLabel', () => {
  it.each([
    [UnitType.LITER, 1, '1 L'],
    [UnitType.LITER, 1.5, '1.5 L'],
    [UnitType.G, 500, '500 g'],
    [UnitType.KG, 10, '10 kg'],
    [UnitType.DOZEN, 1, '1 dozen'],
    [UnitType.ML, 360, '360 ml'],
    [UnitType.BOX, 1, '1 box'],
    [UnitType.PACK, 3, '3 pack'],
  ])('renders %s %s as "%s"', (unitType, unitValue, expected) => {
    expect(formatUnitLabel(unitType, unitValue)).toBe(expected);
  });

  it('pluralises pieces', () => {
    expect(formatUnitLabel(UnitType.PIECE, 1)).toBe('1 pc');
    expect(formatUnitLabel(UnitType.PIECE, 6)).toBe('6 pcs');
  });
});
