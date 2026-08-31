/**
 * The grocery-list scanner API contract, mirrored from the FreshCarts API.
 *
 * Note what the client is trusted with: nothing. Prices and stock levels here
 * are shown so the shopper can decide; the server re-reads every one of them
 * when the list is confirmed, and the confirm request carries only product ids
 * and quantities.
 */

/** How the catalogue search went for one line (§24). */
export type MatchStatus = 'MATCHED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'INVALID';

/**
 * How sure the server is about a match (§19).
 *
 * A category, not a percentage. Kept strictly apart from `source.confidence`,
 * which is how well the OCR engine READ THE LINE — a different measurement of
 * a different thing.
 */
export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** The script a line was written in, so it can be rendered correctly (§50). */
export type ScanScript = 'latin' | 'urdu' | 'mixed' | 'unknown';

export interface ScanCandidate {
  productId: string;
  name: string;
  brand: string | null;
  image: { url: string; alt: string } | null;
  unitLabel: string;
  /** Whole rupees, from the catalogue at the time of the scan. */
  price: number;
  confidence: MatchConfidence;
  availableQuantity: number;
  isAvailable: boolean;
  /** True when the pack size is what the shopper asked for (§21). */
  unitMatches: boolean;
}

/** What was read off the page, before any interpretation (§10). */
export interface ScanSource {
  rawText: string;
  normalizedName: string;
  quantity: number;
  unit: string | null;
  unitValue: number | null;
  brand: string | null;
  /** OCR confidence for this line, or null when the engine reported none. */
  confidence: number | null;
  script: ScanScript;
  quantityAdjusted: boolean;
}

export interface ScanItem {
  lineId: string;
  source: ScanSource;
  match: {
    status: MatchStatus;
    confidence: MatchConfidence | null;
    /** Null for an ambiguous line: the shopper chooses (§27). */
    product: ScanCandidate | null;
  };
  alternatives: ScanCandidate[];
}

export interface ScanSummary {
  detected: number;
  matched: number;
  ambiguous: number;
  notFound: number;
  unavailable: number;
  estimatedTotal: number;
}

export interface ScanResult {
  scanId: string;
  language: 'en' | 'ur' | 'mixed' | 'unknown';
  items: ScanItem[];
  summary: ScanSummary;
  warnings: string[];
}

/** The outcome of adding a confirmed list to the cart (§62). */
export interface ScanConfirmation {
  added: Array<{ productId: string; productName: string; quantity: number }>;
  failed: Array<{
    productId: string;
    productName: string | null;
    requestedQuantity: number;
    /** A sentence written for the shopper, e.g. "Only 4 are available". */
    reason: string;
    availableQuantity?: number;
  }>;
  cart: import('./cart').Cart;
}

/** The only thing the client may send when confirming (§61). */
export interface ConfirmScanInput {
  items: Array<{ productId: string; quantity: number }>;
}
