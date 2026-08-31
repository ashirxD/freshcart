import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryModule } from 'src/modules/inventory';
import { OrdersModule } from 'src/modules/orders';
import { ProductsModule } from 'src/modules/products';
import { CustomerSubstitutionsController } from './customer-substitutions.controller';
import { Substitution, SubstitutionSchema } from './schemas';
import { SubstitutionsService } from './substitutions.service';

/**
 * Sits above orders: a substitution is a change *to* an order, so it depends on
 * the order domain and the order domain knows nothing about it. That direction
 * is what keeps the graph acyclic, and it is why the store-facing order screen
 * gets its proposals through StoreManagerService rather than through
 * OrdersService reaching sideways.
 *
 * The store-facing routes live on the store-manager controller, alongside the
 * rest of the operations surface. The two customer-facing routes are declared
 * here — see CustomerSubstitutionsController for why they cannot live on the
 * orders controller.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Substitution.name, schema: SubstitutionSchema }]),
    OrdersModule,
    ProductsModule,
    InventoryModule,
  ],
  controllers: [CustomerSubstitutionsController],
  providers: [SubstitutionsService],
  exports: [SubstitutionsService],
})
export class SubstitutionsModule {}
