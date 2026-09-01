import { Module } from '@nestjs/common';
import { CategoriesModule } from 'src/modules/categories';
import { DeliveryModule } from 'src/modules/delivery';
import { InventoryModule } from 'src/modules/inventory';
import { OrdersModule } from 'src/modules/orders';
import { ProductsModule } from 'src/modules/products';
import { StoresModule } from 'src/modules/stores';
import { UsersModule } from 'src/modules/users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * The top of the graph, beside StoreManagerModule, and it owns no schema.
 *
 * Every read and write is delegated to the domain service that already owns it.
 * What this module contributes is the control-centre API surface and one
 * genuine cross-domain aggregation — the dashboard. AuditService and
 * SettingsService arrive through their global modules, because an audit trail
 * and business configuration are platform concerns rather than features of
 * administration.
 *
 * Nothing depends on this module, so adding it cannot create a cycle.
 */
@Module({
  imports: [
    UsersModule,
    OrdersModule,
    ProductsModule,
    CategoriesModule,
    InventoryModule,
    StoresModule,
    DeliveryModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
