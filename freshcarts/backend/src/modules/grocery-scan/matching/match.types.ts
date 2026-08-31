/**
 * The vocabulary of product matching (sections 19, 23 and 24).
 */

import type { ProductView } from 'src/modules/products';

/**
 * What happened when we tried to find this item in the catalogue.
 *
 * Four distinct states, none of them overloaded (§24). The difference between
 * AMBIGUOUS and NOT_FOUND in particular drives two completely different
 * screens: "which of these did you mean?" versus "we could not find this".
 */
export enum MatchStatus {
  /** One product is clearly the right answer. */
  MATCHED = 'MATCHED',
  /** Several plausible products; the shopper must choose (§27). */
  AMBIGUOUS = 'AMBIGUOUS',
  /** Nothing in the catalogue is a credible match (§28). */
  NOT_FOUND = 'NOT_FOUND',
  /** The extracted item itself was unusable — no name to search by. */
  INVALID = 'INVALID',
}

/**
 * How sure we are about a match.
 *
 * A category rather than a number, on purpose. The score behind it is a
 * weighted heuristic; presenting it as "91% confident" would be false
 * precision (§19). Three bands is what the scoring actually justifies, and
 * what a shopper can act on.
 *
 * Kept strictly separate from the OCR confidence that arrives on the extracted
 * item: one measures how well the page was read, the other how well the
 * catalogue was searched (§10).
 */
export enum MatchConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/** A product offered as an answer, with everything the card needs to render. */
export interface MatchCandidate {
  productId: string;
  name: string;
  brand: string | null;
  image: { url: string; alt: string } | null;
  /** Pack size as a shelf label would show it: "1 L", "500 g". */
  unitLabel: string;
  /** Current catalogue price in whole rupees. Read fresh, never from the AI. */
  price: number;
  confidence: MatchConfidence;
  /** Units in stock right now. 0 means the shopper cannot buy it today. */
  availableQuantity: number;
  isAvailable: boolean;
  /** True when the pack size matches what the shopper asked for (§21). */
  unitMatches: boolean;
}

/** One line of the scan result: what was read, and what it maps to. */
export interface ScanItemMatch {
  /** Stable id for this line within the scan, so the UI can key on it. */
  lineId: string;
  source: {
    rawText: string;
    normalizedName: string;
    quantity: number;
    unit: string | null;
    unitValue: number | null;
    brand: string | null;
    /** OCR confidence for the line. Null when the engine reported none. */
    confidence: number | null;
    script: string;
    /** True when the written quantity had to be adjusted (§13). */
    quantityAdjusted: boolean;
  };
  match: {
    status: MatchStatus;
    /** Null for NOT_FOUND and INVALID — there is nothing to be confident about. */
    confidence: MatchConfidence | null;
    /** The chosen product, or null when the shopper must decide. */
    product: MatchCandidate | null;
  };
  /** Other plausible products, best first. Capped — see MAX_CANDIDATES (§54). */
  alternatives: MatchCandidate[];
}

/** Internal: a candidate with its score, before it becomes a view. */
export interface ScoredProduct {
  product: ProductView;
  score: number;
  unitMatches: boolean;
}
