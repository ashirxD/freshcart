/**
 * Escapes user input before it is embedded in a RegExp.
 *
 * Skipping this is both a correctness bug (a shopper searching for "1+1" gets a
 * syntax error) and a ReDoS vector, so every regex built from request data must
 * go through here.
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
