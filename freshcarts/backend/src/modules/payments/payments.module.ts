import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CashOnDeliveryProvider, PAYMENT_PROVIDERS, PaymentProvider } from './providers';
import { Payment, PaymentSchema } from './schemas';

/**
 * Adding a payment method is: write a provider, register it in the array below,
 * and enable it in PAYMENT_METHODS_ENABLED. Nothing in checkout or orders
 * changes — they ask PaymentsService what is available and hand it a method.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }])],
  controllers: [PaymentsController],
  providers: [
    CashOnDeliveryProvider,
    {
      provide: PAYMENT_PROVIDERS,
      inject: [CashOnDeliveryProvider],
      useFactory: (cashOnDelivery: CashOnDeliveryProvider): PaymentProvider[] => [cashOnDelivery],
    },
    PaymentsService,
  ],
  exports: [PaymentsService, MongooseModule],
})
export class PaymentsModule {}
