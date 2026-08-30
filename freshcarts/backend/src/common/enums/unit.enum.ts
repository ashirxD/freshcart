/**
 * Grocery selling units. Persisted as strings and part of the API contract.
 *
 * A product is described by a unit PAIR — `unitType` + `unitValue` — so "5 kg
 * Atta" and "1 kg Atta" are the same unit type at different sizes. That keeps
 * pack sizes comparable and sortable instead of buried in free text.
 */
export enum UnitType {
  PIECE = 'PIECE',
  PACK = 'PACK',
  KG = 'KG',
  G = 'G',
  LITER = 'LITER',
  ML = 'ML',
  DOZEN = 'DOZEN',
  BOX = 'BOX',
  BOTTLE = 'BOTTLE',
}

/** Short suffix used when rendering a pack size, e.g. `1 L`, `500 g`, `2 pcs`. */
export const UNIT_ABBREVIATION: Record<UnitType, string> = {
  [UnitType.PIECE]: 'pc',
  [UnitType.PACK]: 'pack',
  [UnitType.KG]: 'kg',
  [UnitType.G]: 'g',
  [UnitType.LITER]: 'L',
  [UnitType.ML]: 'ml',
  [UnitType.DOZEN]: 'dozen',
  [UnitType.BOX]: 'box',
  [UnitType.BOTTLE]: 'bottle',
};

/**
 * Units that only make sense as whole numbers. Enforced by the Product schema,
 * so no write path can produce "2.5 dozen eggs".
 */
export const DISCRETE_UNIT_TYPES: UnitType[] = [
  UnitType.PIECE,
  UnitType.PACK,
  UnitType.DOZEN,
  UnitType.BOX,
  UnitType.BOTTLE,
];
