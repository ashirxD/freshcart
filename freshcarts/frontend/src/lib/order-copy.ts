import type { Locale, TFunction, TranslationKey } from '@/i18n';
import type { FulfillmentMethod, OrderStatus, PaymentStatus } from '@/types/order';

/**
 * THE WORDS FOR WHERE AN ORDER IS
 *
 * The API sends a `statusLabel` ("Collected" for a finished pickup, "Delivered"
 * for a finished delivery) and a `label` on every timeline step. Those are
 * English sentences chosen by the server, and the server may reword them. The
 * STATUS beside them is a stable enum, so the screen is built from that: the
 * status plus the fulfilment method is everything needed to choose the right
 * word in any language.
 *
 * English still shows the server's own label, exactly as before.
 */
export function orderStatusLabel(
  status: OrderStatus,
  fulfillmentMethod: FulfillmentMethod | undefined,
  serverLabel: string | undefined,
  t: TFunction,
  locale: Locale,
): string {
  if (locale === 'en' && serverLabel) return serverLabel;

  // A finished pickup is "collected", not "delivered".
  if (status === 'DELIVERED' && fulfillmentMethod === 'PICKUP') return t('orders.status.COLLECTED');

  return t(('orders.status.' + status) as TranslationKey);
}

export function paymentStatusLabel(status: PaymentStatus, t: TFunction): string {
  return t(('orders.paymentStatus.' + status) as TranslationKey);
}

/**
 * The server's default status notes, word for word, mapped to their keys.
 *
 * `STATUS_NOTES` in the API is an exported table of "shopper-facing wording", so
 * these are exact strings, not guesses. A note that matches one is shown in the
 * active language; any other note is something a person at the store TYPED, and
 * is shown exactly as they wrote it — it is their words, not ours to translate.
 */
const SYSTEM_NOTES: Record<string, TranslationKey> = {
  'Order placed and waiting for the store to confirm.': 'orders.note.PENDING',
  'The store has confirmed your order.': 'orders.note.CONFIRMED',
  'Your order is being prepared.': 'orders.note.PREPARING',
  'Your order has been packed.': 'orders.note.PACKED',
  'Your order is on its way.': 'orders.note.OUT_FOR_DELIVERY',
  'Your order is ready to collect from the store.': 'orders.note.READY_FOR_PICKUP',
  'Order completed.': 'orders.note.DELIVERED',
  'Order cancelled.': 'orders.note.CANCELLED',
  'The store could not accept this order.': 'orders.note.REJECTED',
  'This order could not be completed.': 'orders.note.FAILED',
  'Cancelled by the customer.': 'orders.note.customerCancelled',
};

export function orderNote(note: string, t: TFunction, locale: Locale): string {
  if (locale === 'en') return note;
  const key = SYSTEM_NOTES[note];
  return key ? t(key) : note;
}
