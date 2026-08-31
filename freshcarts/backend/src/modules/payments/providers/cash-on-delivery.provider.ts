import { Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '../enums';
import { PaymentIntent, PaymentProvider } from './payment.provider';

/**
 * Cash on delivery.
 *
 * The whole implementation is one rule, and it is the rule §29 insists on: a
 * COD order starts PENDING. Placing an order is not paying for it — the money
 * arrives when the rider is handed it, and only an authorised operational
 * action may record that. There is no code path here, or anywhere in checkout,
 * that can mark a cash order PAID at creation.
 */
@Injectable()
export class CashOnDeliveryProvider implements PaymentProvider {
  readonly method = PaymentMethod.CASH_ON_DELIVERY;

  async createIntent(): Promise<PaymentIntent> {
    return {
      status: PaymentStatus.PENDING,
      provider: 'cash',
      // Nothing to reconcile against: there is no gateway, only a receipt book.
      providerReference: null,
      paidAt: null,
    };
  }
}
