/**
 * Rendering text whose script we only learn at runtime (§50).
 *
 * A grocery list can come back in Urdu, in Roman Urdu, or in both at once. Urdu
 * is right-to-left and needs its own face and a taller line height — all of
 * which the design system already provides via `:lang(ur)`, but only if the
 * element is actually marked as Urdu.
 *
 * These helpers produce the `lang` and `dir` attributes for one string. They are
 * applied per element rather than per page, because a mixed list has Urdu on one
 * line and Latin on the next, and flipping the whole page for that would move
 * every control the shopper was about to press.
 */

const URDU_LETTERS = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/** True when the text contains Arabic-script (Urdu) letters. */
export function containsUrdu(text: string): boolean {
  return URDU_LETTERS.test(text);
}

export interface TextDirectionAttributes {
  lang?: string;
  dir: 'rtl' | 'ltr' | 'auto';
}

/**
 * The `lang`/`dir` pair for a string of unknown script.
 *
 * `dir="auto"` for mixed content: the browser picks the base direction from the
 * first strong character, which is what the writer's own intent was — a better
 * answer than any rule we could apply from the outside.
 */
export function textDirection(text: string): TextDirectionAttributes {
  if (!containsUrdu(text)) return { dir: 'ltr' };

  // Urdu letters plus Latin letters: leave the base direction to the browser,
  // but still mark it Urdu so the Nastaliq face and line height apply.
  const hasLatin = /[A-Za-z]/.test(text);

  return { lang: 'ur', dir: hasLatin ? 'auto' : 'rtl' };
}
