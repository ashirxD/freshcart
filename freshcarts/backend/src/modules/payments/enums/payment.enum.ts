/**
 * How a shopper pays.
 *
 * The enum lists methods the domain *models*; it is not a list of methods the
 * API accepts. Acceptance is a separate, deliberate decision held in
 * configuration (`PAYMENT_METHODS_ENABLED`) and enforced by PaymentsService —
 * so a method can exist in the type system, in the order schema and in reports
 * long before any customer is offered it.
 *
 * That separation is the point of §28: the enum having CARD in it must never be
 * the reason CARD appears on a checkout screen.
 */
export enum PaymentMethod {
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
  CARD = 'CARD',
  MOBILE_WALLET = 'MOBILE_WALLET',
}

/**
 * Where the money is.
 *
 * PENDING covers both "not yet collected" (cash) and "not yet captured" (a
 * future gateway). The distinction that matters to the business — has the money
 * arrived — is the PENDING/PAID line, and it is the same line for every method.
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

/** ISO 4217. Single-currency today, but never implied by omission. */
export const DEFAULT_CURRENCY = 'PKR';

/** Human labels for messages; the UI has its own copy for its own layout. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH_ON_DELIVERY]: 'Cash on delivery',
  [PaymentMethod.CARD]: 'Card',
  [PaymentMethod.MOBILE_WALLET]: 'Mobile wallet',
};
