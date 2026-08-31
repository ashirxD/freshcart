import { Module } from '@nestjs/common';
import { InventoryModule } from 'src/modules/inventory';
import { OrdersModule } from 'src/modules/orders';
import { ProductsModule } from 'src/modules/products';
import { StoresModule } from 'src/modules/stores';
import { SubstitutionsModule } from 'src/modules/substitutions';
import { StoreManagerController } from './store-manager.controller';
import { StoreManagerService } from './store-manager.service';

/**
 * The top of the graph, and it owns almost nothing.
 *
 * There is no schema here and no repository — every read and write goes to the
 * domain service that already owns it. What this module contributes is the
 * store-scope resolution that turns an authenticated principal into a store id,
 * the operations API surface, and one genuine cross-domain aggregation (the
 * dashboard). §49: a `store-manager/` module is justified precisely because
 * those three things belong to no existing domain.
 */
@Module({
  imports: [OrdersModule, InventoryModule, ProductsModule, SubstitutionsModule, StoresModule],
  controllers: [StoreManagerController],
  providers: [StoreManagerService],
  exports: [StoreManagerService],
})
export class StoreManagerModule {}
