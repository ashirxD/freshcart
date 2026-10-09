import type { Locale, TFunction } from '@/i18n';
import type { ScanConfirmation } from '@/types/scan';

/**
 * Two kinds of sentence the scanner's API writes in English and sends with no
 * code: the warnings on a scan, and the reason a product could not be added.
 *
 * The backend builds both from a short, fixed set (`FAILURE_MESSAGE` in the
 * grocery-scan service, and the OCR service's own warnings), so they are matched
 * here by their exact wording and rebuilt in the active language from the facts
 * the response carries alongside them. Anything not recognised — a new warning
 * the API starts sending — degrades to a general sentence rather than to
 * English in the middle of an Urdu screen, and never to nothing.
 *
 * English is untouched: it shows the server's sentence, as it always did.
 */

const FIRST_N = /^Only the first (\d+) items on the list were read\.?$/;

export function describeScanWarnings(warnings: string[], t: TFunction, locale: Locale): string[] {
  if (locale === 'en') return warnings;

  // Unknown warnings collapse into one general line, shown once.
  const lines = warnings.map((warning) => {
    const firstN = FIRST_N.exec(warning);
    return firstN ? t('ocr.review.warningFirstN', { n: firstN[1] }) : t('ocr.review.warningGeneric');
  });

  return [...new Set(lines)];
}

type Failed = ScanConfirmation['failed'][number];

export function describeScanFailure(entry: Failed, t: TFunction, locale: Locale): string {
  if (locale === 'en') return entry.reason;

  const { reason, productName, availableQuantity } = entry;

  if (availableQuantity !== undefined && /^Only \d+ (is|are) available$/.test(reason)) {
    return t('ocr.outcome.failInsufficient', { count: availableQuantity });
  }
  if (/no longer in our catalogue/i.test(reason)) return t('ocr.outcome.failNotFound');
  if (/out of stock/i.test(reason)) {
    return productName
      ? t('ocr.outcome.failOutOfStock', { name: productName })
      : t('ocr.outcome.failOutOfStockNoName');
  }
  if (/not available right now/i.test(reason)) {
    return productName
      ? t('ocr.outcome.failUnavailable', { name: productName })
      : t('ocr.outcome.failUnavailableNoName');
  }
  if (/already full/i.test(reason)) return t('ocr.outcome.failCartFull');

  return t('ocr.outcome.failGeneric');
}
