import { getActiveLocale, tNow, translateIfKnown, type Locale, type TFunction } from '@/i18n';
import { ApiError } from './errors';
import type { CheckoutIssue } from '@/types/order';

/**
 * WHAT A SHOPPER IS TOLD WHEN A REQUEST FAILS
 *
 * The API's error `message` is English prose, and it may be reworded at any
 * time — that is why the API also sends a stable `code`. So in any language but
 * English the screen never shows the server's sentence: it shows OUR copy for
 * the code, found at `errors.<CODE>`, falling back to copy for the HTTP status,
 * then to a general line. The translation lives in the frontend (which owns the
 * UI's words) and the backend's codes stay exactly as they are.
 *
 * In English the server's message is still shown as-is, as it always was. It was
 * written for a shopper, it names the product or address involved, and replacing
 * it with something more general would make English worse for no gain.
 */

/**
 * A few server sentences that carry no code but that a shopper meets routinely
 * (a wrong password, a taken phone number). Matched EXACTLY, so a reworded
 * message simply falls through to the status copy below rather than being
 * mistranslated.
 */
const KNOWN_MESSAGES: Record<string, string> = {
  'Incorrect phone number or password': 'errors.wrongCredentials',
  'This account has been deactivated. Please contact support.': 'errors.accountDeactivated',
  'Your session has expired. Please sign in again.': 'errors.sessionExpired',
  'No active session': 'errors.sessionExpired',
  'An account with this phone number already exists': 'errors.phoneTaken',
  'An account with this email already exists': 'errors.emailTaken',
  'An account with this phone or email already exists': 'errors.phoneOrEmailTaken',
  'This email is already in use': 'errors.emailTaken',
  'Address not found': 'errors.addressNotFound',
  'Order not found': 'errors.orderNotFound',
  'Product not found': 'errors.productNotFound',
  'Your cart is empty': 'errors.CART_EMPTY',
  'That product is not in your cart': 'errors.notInCart',
};

const STATUS_KEYS: Record<number, string> = {
  0: 'errors.network',
  400: 'errors.validation',
  401: 'errors.unauthorized',
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  422: 'errors.validation',
  429: 'errors.tooManyRequests',
};

/**
 * The sentence to show for a failed request.
 *
 * `t` and `locale` default to the language active right now, so a toast raised
 * from a mutation callback (which has no component to ask) can call
 * `describeError(error)`; a component passes its own for a result that is
 * correct on the very render it appears in.
 */
export function describeError(
  error: unknown,
  t: TFunction = tNow,
  locale: Locale = getActiveLocale(),
): string {
  if (!(error instanceof ApiError)) return t('errors.generic');

  // English keeps the server's own words (see above).
  if (locale === 'en' && error.message) return error.message;

  const byCode = error.code ? translateIfKnown(locale, 'errors.' + error.code) : undefined;
  if (byCode) return byCode;

  const knownKey = KNOWN_MESSAGES[error.message];
  const byMessage = knownKey ? translateIfKnown(locale, knownKey) : undefined;
  if (byMessage) return byMessage;

  const statusKey = STATUS_KEYS[error.status] ?? (error.status >= 500 ? 'errors.generic' : undefined);
  const byStatus = statusKey ? translateIfKnown(locale, statusKey) : undefined;

  return byStatus ?? t('errors.generic');
}

/**
 * The sentence for one blocked line at checkout ("only 2 of eggs are
 * available").
 *
 * The API sends a ready-made English sentence AND the facts behind it — the
 * code, the product, the quantities, the prices. In English the sentence is
 * shown as it always was; in any other language it is rebuilt from the facts, so
 * the product name and the numbers are the server's and only the wording is ours.
 */
export function describeIssue(
  issue: CheckoutIssue,
  t: TFunction = tNow,
  locale: Locale = getActiveLocale(),
  formatMoney: (amount: number) => string = String,
): string {
  if (locale === 'en' && issue.message) return issue.message;

  switch (issue.code) {
    case 'PRODUCT_UNAVAILABLE':
      return t('checkout.issue.PRODUCT_UNAVAILABLE', { name: issue.productName });
    case 'PRODUCT_REMOVED':
      return t('checkout.issue.PRODUCT_REMOVED', { name: issue.productName });
    case 'OUT_OF_STOCK':
      return t('checkout.issue.OUT_OF_STOCK', { name: issue.productName });
    case 'INSUFFICIENT_STOCK':
      return t('checkout.issue.INSUFFICIENT_STOCK', {
        name: issue.productName,
        available: issue.availableQuantity ?? 0,
      });
    case 'PRICE_CHANGED':
      return t('checkout.issue.PRICE_CHANGED', {
        name: issue.productName,
        from: formatMoney(issue.previousPrice ?? 0),
        to: formatMoney(issue.currentPrice ?? 0),
      });
    default:
      return t('errors.generic');
  }
}
