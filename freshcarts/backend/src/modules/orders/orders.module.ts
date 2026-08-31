import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdempotencyModule } from 'src/common/idempotency';
import { CartModule } from 'src/modules/cart/cart.module';
import { CheckoutModule } from 'src/modules/checkout';
import { InventoryModule } from 'src/modules/inventory';
import { PaymentsModule } from 'src/modules/payments';
import { StoresModule } from 'src/modules/stores';
import { OrderNumberService } from './order-number.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderCounter, OrderCounterSchema, OrderSchema } from './schemas';

/**
 * The top of the dependency graph: orders compose checkout (validation and
 * pricing), inventory (stock), payments (money) and cart (cleanup). Nothing in
 * the catalogue depends on orders, so the graph stays acyclic.
 *
 * TransactionRunner arrives through the global DatabaseSupportModule, because
 * the unit-of-work boundary is infrastructure rather than a feature of orders.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderCounter.name, schema: OrderCounterSchema },
    ]),
    CheckoutModule,
    InventoryModule,
    PaymentsModule,
    CartModule,
    StoresModule,
    IdempotencyModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderNumberService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
