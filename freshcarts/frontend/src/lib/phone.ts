export const PK_MOBILE_E164 = /^\+923\d{9}$/;

/**
 * Client-side mirror of the backend normaliser, so a shopper can type the
 * number the way they know it and still see instant, correct validation.
 *
 * The server normalises and validates again — this copy is purely for feedback.
 */
export function normalisePkPhone(input: string): string {
  const digits = input.replace(/[\s()-]/g, '');

  if (/^\+923\d{9}$/.test(digits)) return digits;
  if (/^00923\d{9}$/.test(digits)) return '+' + digits.slice(2);
  if (/^923\d{9}$/.test(digits)) return '+' + digits;
  if (/^03\d{9}$/.test(digits)) return '+92' + digits.slice(1);

  return digits;
}

/**
 * Whether the input is a Pakistani mobile number in any of the forms the
 * normaliser accepts. Feedback only — the server validates independently.
 */
export function isValidPkMobile(input: string): boolean {
  return PK_MOBILE_E164.test(normalisePkPhone(input));
}

/** Renders a stored E.164 number in the local form shoppers recognise. */
export function formatPkPhone(e164: string): string {
  if (!PK_MOBILE_E164.test(e164)) return e164;
  const local = '0' + e164.slice(3);
  return local.slice(0, 4) + ' ' + local.slice(4);
}
