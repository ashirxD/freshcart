/**
 * The scan result as it crosses the API boundary (§23).
 *
 * Prices and stock levels here are read from the catalogue at the moment of the
 * scan. They are shown so the shopper can decide, and they are re-read from
 * scratch when "Add All to Cart" is pressed — this view is never the authority
 * for what anybody is charged (§34).
 */

import { randomUUID } from 'node:crypto';
import type { AiExtractedItem, AiGroceryListResponse } from './ai/ai-ocr.contract';
import {
  MatchConfidence,
  MatchStatus,
  type MatchCandidate,
  type ScanItemMatch,
  type ScoredProduct,
} from './matching/match.types';
import { ProductMatcherService } from './matching/product-matcher.service';

/** The whole response for POST /ocr/grocery-list. */
export interface ScanResultView {
  /** Correlation id for this scan. The same id appears in all three tiers' logs. */
  scanId: string;
  /** Which script the list was written in, so the UI can set lang and dir (§50). */
  language: string;
  items: ScanItemMatch[];
  summary: {
    detected: number;
    matched: number;
    ambiguous: number;
    notFound: number;
    /** Matched, but nothing can be bought today. */
    unavailable: number;
    /** Sum of the confidently matched lines, in whole rupees. Indicative only. */
    estimatedTotal: number;
  };
  /** Shopper-facing notes: a truncated list, a missing language pack. */
  warnings: string[];
}

/** The outcome of confirming a scan (§62). */
export interface ScanConfirmationView {
  added: Array<{ productId: string; productName: string; quantity: number }>;
  failed: Array<{
    productId: string;
    productName: string | null;
    requestedQuantity: number;
    reason: string;
    availableQuantity?: number;
  }>;
  /** The recalculated cart, so the client needs no second request (§63). */
  cart: unknown;
}

function toCandidate(scored: ScoredProduct): MatchCandidate {
  const { product } = scored;

  return {
    productId: product.id,
    name: product.name,
    brand: product.brand ?? null,
    image: product.primaryImage,
    unitLabel: product.unitLabel,
    price: product.sellingPrice,
    confidence: ProductMatcherService.confidenceOf(scored.score),
    availableQuantity: product.stock.quantity,
    isAvailable: product.stock.isAvailable,
    unitMatches: scored.unitMatches,
  };
}

function toItemMatch(
  item: AiExtractedItem,
  candidates: ScoredProduct[],
  status: MatchStatus,
): ScanItemMatch {
  const ranked = candidates.map(toCandidate);
  const isDecided = status === MatchStatus.MATCHED;

  return {
    lineId: randomUUID(),
    source: {
      rawText: item.rawText,
      normalizedName: item.normalizedName,
      quantity: item.quantity,
      unit: item.unit,
      unitValue: item.unitValue,
      brand: item.brand,
      confidence: item.confidence,
      script: item.script,
      quantityAdjusted: item.quantityAdjusted,
    },
    match: {
      status,
      // No confidence is reported when there is nothing to be confident about.
      confidence:
        ranked.length > 0 && status !== MatchStatus.NOT_FOUND ? ranked[0].confidence : null,
      // §27: an ambiguous line is deliberately left unselected. Pre-choosing
      // the first candidate is how a shopper ends up buying the wrong thing
      // because they trusted a tick they did not read.
      product: isDecided ? ranked[0] : null,
    },
    // The chosen product is not repeated in its own alternatives list.
    alternatives: isDecided ? ranked.slice(1) : ranked,
  };
}

export function toScanResultView(
  scanId: string,
  response: AiGroceryListResponse,
  matches: Array<{ candidates: ScoredProduct[]; status: MatchStatus }>,
): ScanResultView {
  const items = response.items.map((item, index) =>
    toItemMatch(
      item,
      matches[index]?.candidates ?? [],
      matches[index]?.status ?? MatchStatus.NOT_FOUND,
    ),
  );

  const matched = items.filter((item) => item.match.status === MatchStatus.MATCHED);
  const buyable = matched.filter((item) => item.match.product?.isAvailable);

  return {
    scanId,
    language: response.language,
    items,
    summary: {
      detected: items.length,
      matched: matched.length,
      ambiguous: items.filter((item) => item.match.status === MatchStatus.AMBIGUOUS).length,
      notFound: items.filter(
        (item) =>
          item.match.status === MatchStatus.NOT_FOUND || item.match.status === MatchStatus.INVALID,
      ).length,
      unavailable: matched.length - buyable.length,
      // Integer rupees, so this addition is exact. Only lines that could
      // actually be bought contribute — an estimate that counts an
      // out-of-stock product is a misleading estimate.
      estimatedTotal: buyable.reduce(
        (sum, item) => sum + (item.match.product?.price ?? 0) * item.source.quantity,
        0,
      ),
    },
    warnings: response.warnings,
  };
}

export { MatchConfidence, MatchStatus };
