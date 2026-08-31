/**
 * Pure text comparison for product matching.
 *
 * No dependency (§75): Dice coefficient over character bigrams is a dozen lines
 * and behaves well on exactly the errors this has to survive — OCR substitutions
 * ("chocklet"), Roman-Urdu spelling drift ("dahee"/"dahi") and missing letters.
 * A Levenshtein package would do the same job for the price of a dependency and
 * a worse ratio on multi-word names.
 *
 * Everything here is a pure function of its inputs, so the ranking rules are
 * testable without a database.
 */

/** Words that carry no distinguishing power in a product name. */
const NOISE_TOKENS = new Set([
  'the',
  'and',
  'with',
  'of',
  'pack',
  'packet',
  'bottle',
  'box',
  'jar',
  'pouch',
  'tin',
  'fresh',
  'premium',
  'special',
  'original',
  'classic',
]);

/**
 * Splits text into comparable tokens.
 *
 * Matches Unicode letters and digits so Urdu product names tokenise correctly;
 * a `[a-z]` class would silently reduce every Urdu name to nothing.
 */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => token.length > 0);
}

/** Tokens worth matching on: noise words and bare single letters removed. */
export function significantTokens(text: string): string[] {
  return tokenize(text).filter((token) => token.length > 1 && !NOISE_TOKENS.has(token));
}

/** Character bigrams of a word, used by the similarity score. */
function bigrams(value: string): string[] {
  const pairs: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    pairs.push(value.slice(index, index + 2));
  }
  return pairs;
}

/**
 * Dice similarity of two strings, from 0 (nothing in common) to 1 (identical).
 *
 * Short strings fall back to equality: "1 L" and "5 L" share no bigram worth
 * scoring, and pretending otherwise produces noise at exactly the length where
 * a wrong answer is most likely.
 */
export function similarity(left: string, right: string): number {
  const a = left.toLowerCase().trim();
  const b = right.toLowerCase().trim();

  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const source = bigrams(a);
  const target = bigrams(b);

  // Counted rather than set-based, so a repeated bigram cannot be matched twice.
  const counts = new Map<string, number>();
  for (const pair of source) counts.set(pair, (counts.get(pair) ?? 0) + 1);

  let shared = 0;
  for (const pair of target) {
    const remaining = counts.get(pair) ?? 0;
    if (remaining > 0) {
      counts.set(pair, remaining - 1);
      shared += 1;
    }
  }

  return (2 * shared) / (source.length + target.length);
}

/**
 * Best similarity between any query token and any product token.
 *
 * Token-level rather than whole-string: "doodh" against "Olper's Full Cream
 * Milk 1L" scores near zero as a whole string, however right it is, because the
 * product name is mostly words the shopper never wrote.
 */
export function bestTokenSimilarity(queryTokens: string[], productTokens: string[]): number {
  let best = 0;

  for (const query of queryTokens) {
    for (const candidate of productTokens) {
      const score = similarity(query, candidate);
      if (score > best) best = score;
      if (best === 1) return 1;
    }
  }

  return best;
}

/** How many of `queryTokens` appear in `productTokens`, as a 0..1 fraction. */
export function tokenCoverage(queryTokens: string[], productTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const available = new Set(productTokens);
  const covered = queryTokens.filter(
    (token) =>
      available.has(token) ||
      // A prefix counts: "egg" covers "eggs", "milk" covers "milkpak". Shorter
      // than four characters this is too loose to trust.
      [...available].some(
        (candidate) => candidate.length >= 4 && token.length >= 4 && candidate.startsWith(token),
      ),
  );

  return covered.length / queryTokens.length;
}

/**
 * A regex that matches `term` at the start of any word.
 *
 * Word-prefix rather than substring: "oil" must find "Cooking Oil" but not
 * "Toilet Cleaner", which contains the letters and none of the meaning.
 */
export function wordPrefixRegex(term: string): RegExp {
  return new RegExp('(^|\\s|-)' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
