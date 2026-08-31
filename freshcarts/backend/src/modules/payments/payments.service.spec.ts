import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { AppConfig } from 'src/common/config/configuration';
import { ErrorCode } from 'src/common/errors';
import { PaymentMethod, PaymentStatus } from './enums';
import { PaymentsService } from './payments.service';
import { CashOnDeliveryProvider, PaymentProvider } from './providers';
import { PaymentDocument } from './schemas';

const ORDER_ID = new Types.ObjectId('64b0000000000000000000f1');
const USER_ID = new Types.ObjectId('64b000000000000000000009');

/** A card provider that exists in code but is not enabled in configuration. */
const stubCardProvider: PaymentProvider = {
  method: PaymentMethod.CARD,
  createIntent: async () => ({
    status: PaymentStatus.PENDING,
    provider: 'stub-gateway',
    providerReference: 'ref_123',
    paidAt: null,
  }),
};

function buildService(options: {
  enabledMethods: string[];
  providers?: PaymentProvider[];
  paymentModel?: Record<string, jest.Mock>;
}) {
  const paymentModel = options.paymentModel ?? {
    create: jest.fn().mockResolvedValue([
      {
        method: PaymentMethod.CASH_ON_DELIVERY,
        status: PaymentStatus.PENDING,
        amount: 800,
        currency: 'PKR',
        paidAt: null,
      },
    ]),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
    deleteOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
  };

  const configService = {
    get: () => ({ enabledMethods: options.enabledMethods }),
  } as unknown as ConfigService<AppConfig, true>;

  const service = new PaymentsService(
    paymentModel as unknown as Model<PaymentDocument>,
    options.providers ?? [new CashOnDeliveryProvider()],
    configService,
  );

  return { service, paymentModel };
}

describe('PaymentsService', () => {
  describe('which methods a shopper may choose', () => {
    it('offers only what is both enabled and implemented', () => {
      const { service } = buildService({ enabledMethods: ['CASH_ON_DELIVERY'] });

      expect(service.availableMethods()).toEqual([
        { method: PaymentMethod.CASH_ON_DELIVERY, label: 'Cash on delivery' },
      ]);
    });

    it('does not offer a method merely because the enum has it', () => {
      // §28's rule. CARD exists in the enum and even has a provider here, but
      // configuration has not enabled it, so no shopper is offered it.
      const { service } = buildService({
        enabledMethods: ['CASH_ON_DELIVERY'],
        providers: [new CashOnDeliveryProvider(), stubCardProvider],
      });

      expect(service.enabledMethods()).toEqual([PaymentMethod.CASH_ON_DELIVERY]);
    });

    it('does not offer a method that is enabled but has no provider behind it', () => {
      // Otherwise checkout would show an option that fails at the last step.
      const { service } = buildService({
        enabledMethods: ['CASH_ON_DELIVERY', 'MOBILE_WALLET'],
      });

      expect(service.enabledMethods()).toEqual([PaymentMethod.CASH_ON_DELIVERY]);
    });

    it('rejects an unavailable method before anything is written', () => {
      const { service, paymentModel } = buildService({ enabledMethods: ['CASH_ON_DELIVERY'] });

      expect(() => service.assertMethodIsAvailable(PaymentMethod.CARD)).toThrow(
        expect.objectContaining({ code: ErrorCode.PAYMENT_METHOD_UNSUPPORTED }),
      );
      expect(paymentModel.create).not.toHaveBeenCalled();
    });
  });

  describe('cash on delivery', () => {
    it('opens the payment as PENDING with no gateway reference', async () => {
      const { service, paymentModel } = buildService({ enabledMethods: ['CASH_ON_DELIVERY'] });

      const summary = await service.createForOrder(
        {
          orderId: ORDER_ID,
          userId: USER_ID,
          method: PaymentMethod.CASH_ON_DELIVERY,
          amount: 800,
        },
        null,
      );

      expect(summary.status).toBe(PaymentStatus.PENDING);

      const written = paymentModel.create.mock.calls[0][0][0] as Record<string, unknown>;
      expect(written).toMatchObject({
        status: PaymentStatus.PENDING,
        provider: 'cash',
        // Nothing to reconcile against: there is no gateway, only a receipt book.
        providerReference: null,
        paidAt: null,
        currency: 'PKR',
      });
    });

    it('never marks cash as paid at order creation', async () => {
      const provider = new CashOnDeliveryProvider();
      const intent = await provider.createIntent();

      expect(intent.status).toBe(PaymentStatus.PENDING);
      expect(intent.paidAt).toBeNull();
    });
  });

  describe('markPaid', () => {
    it('settles only a payment that is still pending', async () => {
      const paymentModel = {
        create: jest.fn(),
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: () => Promise.resolve({ paidAt: new Date('2026-02-02T10:00:00Z') }),
        }),
        updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
        deleteOne: jest.fn(),
      };
      const { service } = buildService({ enabledMethods: ['CASH_ON_DELIVERY'], paymentModel });

      await service.markPaid(ORDER_ID, null);

      expect(paymentModel.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: ORDER_ID, status: PaymentStatus.PENDING },
        expect.objectContaining({ $set: expect.objectContaining({ status: PaymentStatus.PAID }) }),
        expect.anything(),
      );
    });

    it('is idempotent — a repeated confirmation does not rewrite paidAt', async () => {
      const alreadyPaidAt = new Date('2026-02-02T10:00:00Z');
      const paymentModel = {
        create: jest.fn(),
        // Nothing matched: the payment is no longer PENDING.
        findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
        findOne: jest.fn().mockReturnValue({
          select: () => ({
            lean: () => ({ exec: () => Promise.resolve({ paidAt: alreadyPaidAt }) }),
          }),
        }),
        updateOne: jest.fn(),
        deleteOne: jest.fn(),
      };
      const { service } = buildService({ enabledMethods: ['CASH_ON_DELIVERY'], paymentModel });

      await expect(service.markPaid(ORDER_ID, null)).resolves.toEqual(alreadyPaidAt);
    });
  });

  describe('markFailedForCancellation', () => {
    it('only touches an uncollected payment — refunding is a different operation', async () => {
      const paymentModel = {
        create: jest.fn(),
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
        updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(undefined) }),
        deleteOne: jest.fn(),
      };
      const { service } = buildService({ enabledMethods: ['CASH_ON_DELIVERY'], paymentModel });

      await service.markFailedForCancellation(ORDER_ID, 'Cancelled by the customer', null);

      expect(paymentModel.updateOne).toHaveBeenCalledWith(
        { orderId: ORDER_ID, status: PaymentStatus.PENDING },
        expect.objectContaining({
          $set: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
        expect.anything(),
      );
    });
  });
});
