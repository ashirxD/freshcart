import { PaymentMethod, PaymentStatus } from '../enums';

/**
 * What a payment method must be able to do at order creation.
 *
 * Deliberately narrow. A gateway integration will need more — a redirect URL, a
 * webhook handler, a capture step — but adding those to the interface now would
 * be designing against an imagined API. What every method genuinely shares is:
 * what is it called, can it be offered for this order, and what state does the
 * payment record start in.
 */
export interface PaymentIntent {
  status: PaymentStatus;
  provider: string;
  providerReference: string | null;
  /** Set only when the money is already in hand at creation time — never for cash. */
  paidAt: Date | null;
}

export interface PaymentProvider {
  readonly method: PaymentMethod;

  /**
   * Opens a payment for an order that is being created.
   *
   * Returns the initial payment state rather than writing anything: persistence
   * belongs to PaymentsService, inside the same unit of work as the order.
   */
  createIntent(input: { amount: number; currency: string }): Promise<PaymentIntent>;
}

/** Injection token for the set of registered providers. */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
