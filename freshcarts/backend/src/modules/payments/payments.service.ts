import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { BusinessException } from 'src/common/errors';
import { DEFAULT_CURRENCY, PAYMENT_METHOD_LABEL, PaymentMethod, PaymentStatus } from './enums';
import { PAYMENT_PROVIDERS, PaymentProvider } from './providers';
import { Payment, PaymentDocument } from './schemas';

/** The payment facts an order carries on itself, so order reads need no join. */
export interface PaymentSummary {
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt: Date | null;
}

/**
 * Owns payment records and the rule about which methods exist *for shoppers*.
 *
 * The enabled set is configuration, not code: a provider can be implemented,
 * tested and merged while `PAYMENT_METHODS_ENABLED` still lists only cash, and
 * the checkout screen will not offer it. `enabledMethods()` is the single
 * source the API and the UI both read, so the two cannot disagree.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providersByMethod: Map<PaymentMethod, PaymentProvider>;

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[],
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.providersByMethod = new Map(providers.map((provider) => [provider.method, provider]));
  }

  /**
   * Methods a shopper may actually choose.
   *
   * The intersection of two things: configured as enabled, *and* backed by a
   * registered provider. Enabling a method that nothing implements would
   * otherwise produce a checkout option that fails at the last step.
   */
  enabledMethods(): PaymentMethod[] {
    const configured = this.configService.get('payments', { infer: true }).enabledMethods;

    return Object.values(PaymentMethod).filter(
      (method) => configured.includes(method) && this.providersByMethod.has(method),
    );
  }

  /** Method descriptors for the checkout screen — value plus label, nothing more. */
  availableMethods(): Array<{ method: PaymentMethod; label: string }> {
    return this.enabledMethods().map((method) => ({
      method,
      label: PAYMENT_METHOD_LABEL[method],
    }));
  }

  /** Rejects a method the customer is not permitted to use, before anything is written. */
  assertMethodIsAvailable(method: PaymentMethod): void {
    if (!this.enabledMethods().includes(method)) {
      throw BusinessException.paymentMethodUnsupported(PAYMENT_METHOD_LABEL[method] ?? method);
    }
  }

  /**
   * Creates the payment record for a newly placed order.
   *
   * Takes the session so it joins the order's unit of work: on a replica set it
   * is part of the same transaction, and on a standalone deployment the caller
   * registers the compensating delete.
   */
  async createForOrder(
    input: {
      orderId: Types.ObjectId;
      userId: Types.ObjectId;
      method: PaymentMethod;
      amount: number;
    },
    session: ClientSession | null,
  ): Promise<PaymentSummary> {
    this.assertMethodIsAvailable(input.method);

    const provider = this.providersByMethod.get(input.method);
    if (!provider) throw BusinessException.paymentMethodUnsupported(input.method);

    const intent = await provider.createIntent({
      amount: input.amount,
      currency: DEFAULT_CURRENCY,
    });

    const [payment] = await this.paymentModel.create(
      [
        {
          orderId: input.orderId,
          userId: input.userId,
          method: input.method,
          status: intent.status,
          amount: input.amount,
          currency: DEFAULT_CURRENCY,
          provider: intent.provider,
          providerReference: intent.providerReference,
          paidAt: intent.paidAt,
        },
      ],
      { session: session ?? undefined },
    );

    // Amount and method only. Never a reference, never customer identifiers
    // beyond the order this is already scoped to.
    this.logger.log(
      'Payment opened for order ' +
        input.orderId.toString() +
        ': ' +
        input.method +
        ' ' +
        intent.status,
    );

    return {
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
    };
  }

  /** Compensating delete, used when order creation fails without a transaction. */
  async removeForOrder(orderId: Types.ObjectId): Promise<void> {
    await this.paymentModel.deleteOne({ orderId }).exec();
  }

  /**
   * Records that the money arrived.
   *
   * Called by the order lifecycle when a COD order reaches DELIVERED — never by
   * a customer-facing endpoint, and never at order creation. Idempotent, so a
   * repeated delivery confirmation cannot rewrite `paidAt`.
   */
  async markPaid(orderId: Types.ObjectId, session: ClientSession | null): Promise<Date | null> {
    const paidAt = new Date();

    const updated = await this.paymentModel
      .findOneAndUpdate(
        { orderId, status: PaymentStatus.PENDING },
        { $set: { status: PaymentStatus.PAID, paidAt } },
        { new: true, session: session ?? undefined },
      )
      .exec();

    if (updated) {
      this.logger.log('Payment marked PAID for order ' + orderId.toString());
      return updated.paidAt;
    }

    // Already paid, refunded or failed — leave it alone and report what is there.
    const existing = await this.paymentModel.findOne({ orderId }).select('paidAt').lean().exec();
    return existing?.paidAt ?? null;
  }

  /**
   * A cancelled order's payment can never be collected.
   *
   * Only a payment that has not been collected is touched: refunding a paid
   * order is a different operation with different authorisation, and it belongs
   * to the milestone that introduces real money movement.
   */
  async markFailedForCancellation(
    orderId: Types.ObjectId,
    reason: string,
    session: ClientSession | null,
  ): Promise<void> {
    await this.paymentModel
      .updateOne(
        { orderId, status: PaymentStatus.PENDING },
        { $set: { status: PaymentStatus.FAILED, failureReason: reason } },
        { session: session ?? undefined },
      )
      .exec();
  }

  async findForOrder(orderId: Types.ObjectId): Promise<PaymentSummary | null> {
    const payment = await this.paymentModel.findOne({ orderId }).lean().exec();

    return payment
      ? {
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          paidAt: payment.paidAt,
        }
      : null;
  }
}
