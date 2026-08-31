/**
 * PRODUCT MATCHING
 * ================
 *
 * Takes the grocery items the AI service read off a photo and finds the real
 * FreshCarts products they mean.
 *
 * This is deliberately a NestJS responsibility (§0, §17). The catalogue lives
 * in MongoDB, product identity and price are business facts, and the AI service
 * has never seen either. It contributes normalisation — "doodh" is milk — and
 * nothing else.
 *
 * THE PIPELINE (§17)
 *
 *     extracted item -> candidate query -> score -> rank -> classify
 *
 * Scoring is deterministic and tiered, and the tiers are what enforce §18: an
 * exact catalogue hit lives in a band no fuzzy match can reach, so a
 * plausible-looking wrong product can never outrank the right one. There is no
 * LLM here, and §52 is right that there should not be — "1 kg cheeni" needs a
 * lookup table, not a language model.
 *
 * ONE QUERY, NOT N (§53, §68)
 *
 * Every item's search terms are collected first and issued as a single query,
 * then all the scoring happens in memory. A twelve-item list costs one round
 * trip, not twelve — and never the whole catalogue.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { INVENTORY_COLLECTION } from 'src/modules/inventory/schemas';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { LeanProduct, ProductView, toProductView } from 'src/modules/products';
import { Product, ProductDocument } from 'src/modules/products/schemas';
import type { AiExtractedItem } from '../ai/ai-ocr.contract';
import { MatchConfidence, MatchStatus, type ScoredProduct } from './match.types';
import {
  bestTokenSimilarity,
  significantTokens,
  tokenCoverage,
  wordPrefixRegex,
} from './text-match';
import { compareUnits } from './unit-compatibility';

/**
 * Score tiers (§18).
 *
 * The gaps between them are the point: no amount of unit bonus can lift a fuzzy
 * match into the exact-name band, so "a semantically similar but incorrect
 * product" cannot outrank a catalogue hit.
 */
const SCORE = {
  /** The product is called exactly what the shopper wrote. */
  EXACT_NAME: 200,
  /** An alias in searchTerms is exactly what the shopper wrote. */
  EXACT_ALIAS: 170,
  /** Every word the shopper wrote appears in the product. */
  ALL_TOKENS: 120,
  /** The brand alone matched, and nothing else did. */
  BRAND_ONLY: 95,
  /** Most words matched; scaled by how many. */
  PARTIAL_TOKENS_BASE: 60,
  PARTIAL_TOKENS_RANGE: 40,
  /** Fuzzy similarity. Capped below every exact tier, by design. */
  FUZZY_BASE: 20,
  FUZZY_RANGE: 40,
} as const;

/**
 * A second, independent piece of evidence pointing at the same product.
 *
 * This is what separates two products that both satisfy the shopper's *word*.
 * "olper's doodh" and "doodh" both hit the milk alias on every milk in the
 * catalogue — the brand is the only thing that says which one, so a base score
 * alone would leave the shopper choosing between identical-looking options they
 * had already chosen between on paper.
 *
 * Two signals qualify, and each is exact rather than approximate: the brand
 * matched, or a word the shopper actually wrote (as opposed to the vocabulary's
 * translation of it) hit an alias. "Surf 1" normalises to "detergent", which
 * every washing powder answers; the word "surf" is what picks one.
 */
const CORROBORATION_BONUS = 30;

/** Below this a product is not a credible answer and is not offered at all. */
const MIN_SCORE = 45;

/** Similarity below this is coincidence, not a typo. */
const MIN_FUZZY_SIMILARITY = 0.55;

/**
 * How far ahead the leader must be to be treated as the answer.
 *
 * Without a gap requirement, "surf" would pick whichever detergent happened to
 * sort first and present it as certain — the exact behaviour §20 and §27
 * prohibit.
 */
const DECISIVE_GAP = 30;

/** Confidence bands (§19). Categories, because the score is a heuristic. */
const HIGH_CONFIDENCE_SCORE = 140;
const MEDIUM_CONFIDENCE_SCORE = 85;

/** An out-of-stock product is still the right product, just not today. */
const OUT_OF_STOCK_PENALTY = 8;

/** §54: a handful of choices reduces effort; a hundred multiplies it. */
export const MAX_CANDIDATES = 5;

/** Ceilings that keep one scan's cost bounded regardless of what it contains. */
const MAX_QUERY_TERMS = 120;
const MAX_CANDIDATE_POOL = 400;

type ProductWithStock = LeanProduct & {
  stockRow?: Array<{ quantity: number; lowStockThreshold: number }>;
};

/** A product with the pre-computed tokens every item will be scored against. */
interface IndexedProduct {
  view: ProductView;
  nameTokens: string[];
  aliasTokens: Set<string>;
  /** Name plus brand plus aliases — everything a query token could hit. */
  allTokens: string[];
  normalizedName: string;
  normalizedBrand: string | null;
}

@Injectable()
export class ProductMatcherService {
  private readonly logger = new Logger(ProductMatcherService.name);

  constructor(@InjectModel(Product.name) private readonly productModel: Model<ProductDocument>) {}

  /**
   * Finds catalogue products for every extracted item.
   *
   * Returns the ranked candidates per item, in the order the items were read.
   * Classification into MATCHED / AMBIGUOUS / NOT_FOUND happens here too, so
   * the rule lives in one place rather than being re-derived by each caller.
   */
  async matchAll(
    items: AiExtractedItem[],
    storeId: Types.ObjectId,
  ): Promise<Array<{ candidates: ScoredProduct[]; status: MatchStatus }>> {
    if (items.length === 0) return [];

    const pool = await this.loadCandidatePool(items, storeId);

    this.logger.log(
      'Matching ' + items.length + ' item(s) against ' + pool.length + ' candidate product(s)',
    );

    return items.map((item) => {
      const candidates = ProductMatcherService.rank(item, pool);
      return { candidates, status: ProductMatcherService.classify(item, candidates) };
    });
  }

  // --- Candidate retrieval ------------------------------------------------

  /**
   * One query for the whole list.
   *
   * Store scope is in the filter, not applied afterwards (§55): a product from
   * another store is never fetched, so it can never be ranked, offered or
   * added. Inactive products are excluded for the same reason.
   */
  private async loadCandidatePool(
    items: AiExtractedItem[],
    storeId: Types.ObjectId,
  ): Promise<IndexedProduct[]> {
    const { tokens, prefixes } = ProductMatcherService.collectSearchTerms(items);

    if (tokens.length === 0 && prefixes.length === 0) return [];

    const match: FilterQuery<ProductDocument> = {
      storeId,
      isActive: true,
      $or: [
        // Exact alias hit. `searchTerms` is indexed, so this arm is the cheap
        // one and carries most of the Roman-Urdu vocabulary.
        ...(tokens.length > 0 ? [{ searchTerms: { $in: tokens } }] : []),
        ...(prefixes.length > 0 ? [{ name: { $in: prefixes } }] : []),
        ...(prefixes.length > 0 ? [{ brand: { $in: prefixes } }] : []),
      ],
    };

    const pipeline: PipelineStage[] = [
      { $match: match },
      // Bounded before the join, so a pathological query cannot pull the
      // catalogue through the stock lookup.
      { $limit: MAX_CANDIDATE_POOL },
      {
        $lookup: {
          from: INVENTORY_COLLECTION,
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$productId', '$$productId'] }, { $eq: ['$storeId', storeId] }],
                },
              },
            },
            { $project: { _id: 0, quantity: 1, lowStockThreshold: 1 } },
          ],
          as: 'stockRow',
        },
      },
    ];

    const rows = await this.productModel.aggregate<ProductWithStock>(pipeline).exec();

    return rows.map((row) => ProductMatcherService.index(row));
  }

  /**
   * Gathers every term worth querying on, across all items at once.
   *
   * Both the normalised name AND the raw text contribute. That redundancy is
   * deliberate: "Surf 1" normalises to "detergent", which finds every washing
   * powder — but the word the shopper actually wrote, "surf", is what finds the
   * Surf Excel product exactly. Dropping either loses matches.
   */
  private static collectSearchTerms(items: AiExtractedItem[]): {
    tokens: string[];
    prefixes: RegExp[];
  } {
    const tokens = new Set<string>();

    for (const item of items) {
      for (const token of significantTokens(item.normalizedName)) tokens.add(token);
      for (const token of significantTokens(item.rawText)) tokens.add(token);
      if (item.brand) {
        for (const token of significantTokens(item.brand)) tokens.add(token);
      }
    }

    const bounded = [...tokens].slice(0, MAX_QUERY_TERMS);

    return {
      tokens: bounded,
      prefixes: bounded.map(wordPrefixRegex),
    };
  }

  /**
   * Pre-computes everything an item will be compared against.
   *
   * Takes the raw document rather than a ProductView because matching needs
   * `searchTerms`, and `searchTerms` is deliberately not on the public product
   * shape — the Roman-Urdu alias list is an internal search asset, not
   * something every product card should carry to every browser.
   */
  private static index(row: ProductWithStock): IndexedProduct {
    const view = toProductView(row, InventoryService.toStockView(row.stockRow?.[0] ?? null));

    const nameTokens = significantTokens(view.name);
    const aliasTokens = new Set<string>();

    for (const term of row.searchTerms ?? []) {
      const normalized = term.toLowerCase().trim();
      if (normalized) aliasTokens.add(normalized);
    }

    const brandTokens = view.brand ? significantTokens(view.brand) : [];

    return {
      view,
      nameTokens,
      aliasTokens,
      allTokens: [
        ...new Set([...nameTokens, ...brandTokens, ...[...aliasTokens].flatMap(significantTokens)]),
      ],
      normalizedName: view.name.toLowerCase().trim(),
      normalizedBrand: view.brand ? view.brand.toLowerCase().trim() : null,
    };
  }

  // --- Scoring ------------------------------------------------------------

  /** Ranks the pool for one item. Pure, so every rule below is unit-testable. */
  static rank(item: AiExtractedItem, pool: IndexedProduct[]): ScoredProduct[] {
    const scored: ScoredProduct[] = [];

    for (const candidate of pool) {
      const result = ProductMatcherService.score(item, candidate);
      if (result.score >= MIN_SCORE) scored.push(result);
    }

    const ranked = scored.sort(
      (a, b) =>
        b.score - a.score ||
        // Deterministic beyond the score: an in-stock product first, then a
        // stable id order so the same list never reorders between requests.
        Number(b.product.stock.isAvailable) - Number(a.product.stock.isAvailable) ||
        a.product.id.localeCompare(b.product.id),
    );

    return ProductMatcherService.pruneWeak(ranked).slice(0, MAX_CANDIDATES);
  }

  /**
   * Drops the weak tail when there is something better on the list.
   *
   * Found by running a real scan: "2 doodh" returned three genuine milks and
   * then a loaf of "Dawn Milky Bread" and a bar of "Cadbury Dairy Milk", both
   * of which contain the word and neither of which is milk. Offering them next
   * to three correct answers does not help a shopper choose - it makes them
   * doubt the two that were right (§54).
   *
   * The tail is kept when it is ALL there is, because a weak suggestion still
   * beats "we couldn't find this item".
   */
  private static pruneWeak(ranked: ScoredProduct[]): ScoredProduct[] {
    if (ranked.length === 0) return ranked;

    const best = ranked[0].score;
    if (best < MEDIUM_CONFIDENCE_SCORE) return ranked;

    return ranked.filter((candidate) => candidate.score >= MEDIUM_CONFIDENCE_SCORE);
  }

  private static score(item: AiExtractedItem, candidate: IndexedProduct): ScoredProduct {
    const queryName = item.normalizedName.toLowerCase().trim();
    const queryTokens = significantTokens(item.normalizedName);
    const rawTokens = significantTokens(item.rawText);
    // The shopper's own words get a chance even when the vocabulary rewrote
    // them, which is what makes "Surf 1" reach the Surf Excel product.
    const searchTokens = [...new Set([...queryTokens, ...rawTokens])];

    const brandMatches =
      item.brand !== null &&
      candidate.normalizedBrand !== null &&
      candidate.normalizedBrand === item.brand.toLowerCase().trim();

    // A word the shopper actually wrote — not the vocabulary's translation of
    // it — that this product answers to. The distinctness check matters: when
    // the raw word and the canonical name are the same word, there is only one
    // piece of evidence, not two.
    const rawAliasMatches = rawTokens.some(
      (token) => token !== queryName && candidate.aliasTokens.has(token),
    );

    // --- Base: how well the NAME matches, on the tiers §18 sets out ---------
    let base: number;

    if (candidate.normalizedName === queryName) {
      base = SCORE.EXACT_NAME;
    } else if (candidate.aliasTokens.has(queryName) || rawAliasMatches) {
      base = SCORE.EXACT_ALIAS;
    } else {
      const coverage = tokenCoverage(searchTokens, candidate.allTokens);

      if (coverage >= 1) {
        base = SCORE.ALL_TOKENS;
      } else if (coverage > 0) {
        base = SCORE.PARTIAL_TOKENS_BASE + coverage * SCORE.PARTIAL_TOKENS_RANGE;
      } else {
        // Last resort: a spelling close enough to be a typo rather than a
        // different word. Capped well below every exact tier (§18) — even with
        // every bonus below applied, a fuzzy match cannot reach EXACT_ALIAS.
        const closeness = bestTokenSimilarity(searchTokens, candidate.allTokens);
        base =
          closeness >= MIN_FUZZY_SIMILARITY
            ? SCORE.FUZZY_BASE + (closeness - MIN_FUZZY_SIMILARITY) * SCORE.FUZZY_RANGE * 2
            : 0;
      }

      // A matching brand is a real hit even when no product word landed, so it
      // sets a floor rather than being lost among weaker evidence.
      if (brandMatches) base = Math.max(base, SCORE.BRAND_ONLY);
    }

    if (base === 0) {
      return { product: candidate.view, score: 0, unitMatches: false };
    }

    // --- Corroboration: independent evidence for the same product -----------
    if (brandMatches) base += CORROBORATION_BONUS;
    if (rawAliasMatches) base += CORROBORATION_BONUS;

    const unit = compareUnits(
      { unit: item.unit, unitValue: item.unitValue },
      { unitType: candidate.view.unitType, unitValue: candidate.view.unitValue },
    );

    const availability = candidate.view.stock.isAvailable ? 0 : -OUT_OF_STOCK_PENALTY;

    return {
      product: candidate.view,
      score: Math.max(0, base + unit.adjustment + availability),
      unitMatches: unit.exact,
    };
  }

  // --- Classification (§24) -----------------------------------------------

  /**
   * Decides whether the shopper needs to be asked.
   *
   * The bar for MATCHED is deliberately high, and it is two conditions rather
   * than one: the leader must be strong *and* clearly ahead. A confident wrong
   * product silently added to a cart is a far worse outcome than one extra tap
   * — §27 is explicit that a low-confidence leader must not be auto-selected.
   */
  static classify(item: AiExtractedItem, candidates: ScoredProduct[]): MatchStatus {
    if (item.normalizedName.trim().length === 0) return MatchStatus.INVALID;
    if (candidates.length === 0) return MatchStatus.NOT_FOUND;

    const [leader, runnerUp] = candidates;

    if (leader.score < HIGH_CONFIDENCE_SCORE) return MatchStatus.AMBIGUOUS;
    if (!runnerUp) return MatchStatus.MATCHED;

    return leader.score - runnerUp.score >= DECISIVE_GAP
      ? MatchStatus.MATCHED
      : MatchStatus.AMBIGUOUS;
  }

  /** The band a score falls in (§19). */
  static confidenceOf(score: number): MatchConfidence {
    if (score >= HIGH_CONFIDENCE_SCORE) return MatchConfidence.HIGH;
    if (score >= MEDIUM_CONFIDENCE_SCORE) return MatchConfidence.MEDIUM;
    return MatchConfidence.LOW;
  }
}
