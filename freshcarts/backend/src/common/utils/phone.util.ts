/**
 * Pakistani mobile numbers are entered in several shapes (0300xxxxxxx,
 * 92300xxxxxxx, +92300xxxxxxx). We normalise to E.164 so that "the same
 * number" always resolves to exactly one account.
 */
export const PK_MOBILE_E164 = /^\+923\d{9}$/;

export function normalisePkPhone(input: string): string {
  const digits = input.replace(/[\s()-]/g, '');

  if (/^\+923\d{9}$/.test(digits)) return digits;
  if (/^00923\d{9}$/.test(digits)) return '+' + digits.slice(2);
  if (/^923\d{9}$/.test(digits)) return '+' + digits;
  if (/^03\d{9}$/.test(digits)) return '+92' + digits.slice(1);

  // Unknown shape: return as-is and let DTO validation reject it.
  return digits;
}

export function isValidPkPhone(input: string): boolean {
  return PK_MOBILE_E164.test(normalisePkPhone(input));
}
