/**
 * Unit compatibility between what the shopper asked for and what is on the
 * shelf (§21).
 *
 * The rule §21 sets out is a balance, not a filter:
 *
 *   - "2 kg rice" should not strongly match a 500 g bag purely because both
 *     say "rice".
 *   - "rice 5 kg" against a "Rice 5kg" product IS a strong match and must be
 *     recognised as one.
 *   - But a unit mismatch must NEVER reject a product outright. A shopper who
 *     wrote "1 kg atta" and is shown a 5 kg bag has still been shown the right
 *     product; they can change the pack. A shopper shown nothing has been
 *     failed.
 *
 * So this returns an adjustment, and the caller adds it to a name-based score.
 * Units refine a ranking. They never decide one.
 */

import { UnitType } from 'src/common/enums';
import type { AiUnit } from '../ai/ai-ocr.contract';

/**
 * Score added when the pack size is exactly what was asked for.
 *
 * Large on purpose: a shopper who wrote "5 kg atta" has told us which bag they
 * want, and that is a stronger signal than anything else available once the
 * name has matched. It is nonetheless bounded below the gap between the
 * exact-alias and all-tokens tiers, so a pack size can reorder equally-named
 * products but can never lift a weaker name match over a stronger one (§18).
 */
export const EXACT_UNIT_BONUS = 45;
/** Added when the unit family matches but the size does not. */
export const SAME_FAMILY_BONUS = 6;
/** Subtracted when the shopper named a unit the product cannot satisfy. */
export const INCOMPATIBLE_PENALTY = 12;

/**
 * Which units measure the same physical thing.
 *
 * Weight and volume are separate families because a kilo of rice and a litre of
 * oil are not interchangeable, however similar their names.
 */
type UnitFamily = 'weight' | 'volume' | 'count';

const AI_UNIT_FAMILY: Record<AiUnit, UnitFamily> = {
  kg: 'weight',
  g: 'weight',
  liter: 'volume',
  ml: 'volume',
  dozen: 'count',
  piece: 'count',
  pack: 'count',
  bottle: 'count',
  box: 'count',
};

const PRODUCT_UNIT_FAMILY: Record<UnitType, UnitFamily> = {
  [UnitType.KG]: 'weight',
  [UnitType.G]: 'weight',
  [UnitType.LITER]: 'volume',
  [UnitType.ML]: 'volume',
  [UnitType.DOZEN]: 'count',
  [UnitType.PIECE]: 'count',
  [UnitType.PACK]: 'count',
  [UnitType.BOX]: 'count',
  [UnitType.BOTTLE]: 'count',
};

/** Multiplier onto the family's base unit: grams, millilitres, or things. */
const AI_UNIT_SCALE: Record<AiUnit, number> = {
  kg: 1000,
  g: 1,
  liter: 1000,
  ml: 1,
  dozen: 12,
  piece: 1,
  pack: 1,
  bottle: 1,
  box: 1,
};

const PRODUCT_UNIT_SCALE: Record<UnitType, number> = {
  [UnitType.KG]: 1000,
  [UnitType.G]: 1,
  [UnitType.LITER]: 1000,
  [UnitType.ML]: 1,
  [UnitType.DOZEN]: 12,
  [UnitType.PIECE]: 1,
  [UnitType.PACK]: 1,
  [UnitType.BOX]: 1,
  [UnitType.BOTTLE]: 1,
};

/**
 * Sizes are compared with a tolerance, because a shopper writing "1 litre milk"
 * means the 1 L carton even if it is labelled 1000 ml — and because OCR reading
 * "1kg" off a photo is not a precision instrument.
 */
const SIZE_TOLERANCE = 0.02;

export interface UnitRequest {
  unit: AiUnit | null;
  /** The size asked for, in `unit`. Null when the shopper gave no size. */
  unitValue: number | null;
}

export interface UnitVerdict {
  /** Added to the name score. Can be negative. */
  adjustment: number;
  /** True only when the pack size is genuinely what was asked for. */
  exact: boolean;
}

/**
 * Compares a requested unit against a product's pack size.
 *
 * A request with no unit is neutral: "2 milk" says nothing about pack size, so
 * every milk product is equally eligible and the ranking is decided on name
 * alone.
 */
export function compareUnits(
  request: UnitRequest,
  product: { unitType: UnitType; unitValue: number },
): UnitVerdict {
  if (!request.unit) {
    return { adjustment: 0, exact: false };
  }

  const requestedFamily = AI_UNIT_FAMILY[request.unit];
  const productFamily = PRODUCT_UNIT_FAMILY[product.unitType];

  if (requestedFamily !== productFamily) {
    // "1 kg atta" against a 1-litre bottle: wrong kind of thing entirely.
    // Penalised, not excluded — the name match may still be right and the
    // shopper is the one who decides.
    return { adjustment: -INCOMPATIBLE_PENALTY, exact: false };
  }

  // A unit with no size ("a dozen anday", "a packet of biscuits") tells us the
  // family and nothing more, which is already a useful signal.
  if (request.unitValue === null) {
    return { adjustment: SAME_FAMILY_BONUS, exact: false };
  }

  const requested = request.unitValue * AI_UNIT_SCALE[request.unit];
  const available = product.unitValue * PRODUCT_UNIT_SCALE[product.unitType];

  if (available <= 0) return { adjustment: 0, exact: false };

  const ratio = requested / available;

  if (Math.abs(ratio - 1) <= SIZE_TOLERANCE) {
    return { adjustment: EXACT_UNIT_BONUS, exact: true };
  }

  // A whole-number multiple is the "2 kg rice from 1 kg bags" case §22 raises.
  // Genuinely useful, so it beats an unrelated size — but it is not what was
  // asked for, so it does not count as exact and the UI still shows the choice.
  const multiple = requested / available;
  if (multiple > 1 && Math.abs(multiple - Math.round(multiple)) <= SIZE_TOLERANCE) {
    return { adjustment: SAME_FAMILY_BONUS + 4, exact: false };
  }

  return { adjustment: SAME_FAMILY_BONUS, exact: false };
}

/**
 * How many packs to buy to cover a requested size.
 *
 * "2 kg rice" with only 1 kg bags on the shelf is two bags. Returns 1 whenever
 * the question does not arise, and never more than a sane number of packs —
 * the shopper sees and confirms this number before anything reaches the cart
 * (§22, §60).
 */
export function packsRequired(
  request: UnitRequest,
  product: { unitType: UnitType; unitValue: number },
  maximum = 12,
): number {
  if (!request.unit || request.unitValue === null) return 1;
  if (AI_UNIT_FAMILY[request.unit] !== PRODUCT_UNIT_FAMILY[product.unitType]) return 1;

  const requested = request.unitValue * AI_UNIT_SCALE[request.unit];
  const available = product.unitValue * PRODUCT_UNIT_SCALE[product.unitType];

  if (available <= 0) return 1;

  const packs = Math.ceil(requested / available - SIZE_TOLERANCE);
  return Math.min(Math.max(packs, 1), maximum);
}
