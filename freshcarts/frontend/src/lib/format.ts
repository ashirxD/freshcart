/**
 * Presentation helpers.
 *
 * Formatting only — no pricing rules. Discounts, unit labels and availability
 * all arrive pre-computed from the API, which stays the single authority.
 */

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

/** Accessible spoken form, so a screen reader says "1450 rupees" not "Rs dot". */
export function formatPkrLabel(amount: number): string {
  return PKR.format(amount) + ' rupees';
}

/** "12" up to 99, then "99+", for navigation badges. */
export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/**
 * A stable colour per product, so the placeholder tile for a product without
 * imagery still looks deliberate and is recognisable between visits.
 */
const PLACEHOLDER_TINTS = [
  'bg-[#e8efe6]',
  'bg-[#f3ecdd]',
  'bg-[#e6edf1]',
  'bg-[#f1e8e8]',
  'bg-[#eae9f1]',
] as const;

export function placeholderTint(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return PLACEHOLDER_TINTS[Math.abs(hash) % PLACEHOLDER_TINTS.length];
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
