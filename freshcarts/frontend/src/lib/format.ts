/**
 * Presentation helpers.
 *
 * Formatting only — no pricing rules. Discounts, unit labels and availability
 * all arrive pre-computed from the API, which stays the single authority.
 */

import type { TFunction } from '@/i18n';

const PKR = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/**
 * Renders whole rupees the way a Pakistani shelf label does: `Rs. 1,450`.
 * Prices are integers end to end, so there is never a fraction to round here.
 */
export function formatPkr(amount: number): string {
  return 'Rs. ' + PKR.format(amount);
}

/**
 * Accessible spoken form, so a screen reader says "1450 rupees" not "Rs dot".
 * Pass `t` to get the word in the active language; without it the English form
 * is returned, which is what any non-visual caller still gets.
 */
export function formatPkrLabel(amount: number, t?: TFunction): string {
  const figure = PKR.format(amount);
  return t ? t('product.rupees', { amount: figure }) : figure + ' rupees';
}

/** "12" up to 99, then "99+", for navigation badges. */
export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/**
 * The wash behind a product image.
 *
 * Every product gets one, photographed or not (§24). A packshot on flat white
 * floats; the same packshot on a warm tint sits on a surface, and the tile
 * reads as an object rather than a hole in the card.
 *
 * The tints are palette tokens at low opacity — never an arbitrary hex, and
 * never saturated enough to compete with the product itself. Each is stable per
 * product name, so the same item looks the same on every screen and every
 * visit, and a rail of cards comes out varied rather than striped.
 */
const PRODUCT_TINTS = [
  'bg-leaf/8',
  'bg-cream',
  'bg-peach/30',
  'bg-sand/45',
  'bg-teal/8',
  'bg-berry/8',
] as const;

export function productTint(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return PRODUCT_TINTS[Math.abs(hash) % PRODUCT_TINTS.length];
}

/**
 * Up to two initials from a product name, for the placeholder tile.
 *
 * Leading punctuation is stripped first: "Onions (Pyaz)" should read as "OP",
 * not "O(".
 */
export function initialsFor(name: string): string {
  return name
    .split(/[\s\-/]+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
