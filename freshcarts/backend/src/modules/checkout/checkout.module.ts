import { Module } from '@nestjs/common';
import { AddressesModule } from 'src/modules/addresses';
import { CartModule } from 'src/modules/cart/cart.module';
import { DeliveryModule } from 'src/modules/delivery';
import { PaymentsModule } from 'src/modules/payments';
import { ProductsModule } from 'src/modules/products';
import { StoresModule } from 'src/modules/stores';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

/**
 * Checkout composes; it owns no collection of its own. That is deliberate — the
 * validation-and-pricing rules are the asset here, and keeping them free of
 * persistence is what lets OrdersModule reuse them verbatim at order creation
 * instead of reimplementing "is this still buyable?" a second time.
 */
@Module({
  imports: [
    CartModule,
    ProductsModule,
    AddressesModule,
    DeliveryModule,
    PaymentsModule,
    StoresModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
