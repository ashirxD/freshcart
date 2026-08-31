import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from 'src/common/config/configuration';
import { validateEnv } from 'src/common/config/env.validation';
import { DatabaseModule } from 'src/database/database.module';
import { AddressesModule } from 'src/modules/addresses';
import { Cart, CartSchema } from 'src/modules/cart/schemas';
import { CategoriesModule } from 'src/modules/categories';
import { DeliveryModule } from 'src/modules/delivery';
import { Favorite, FavoriteSchema } from 'src/modules/favorites/schemas';
import { InventoryModule } from 'src/modules/inventory';
import { Order, OrderSchema } from 'src/modules/orders/schemas';
import { PaymentsModule } from 'src/modules/payments';
import { ProductsModule } from 'src/modules/products';
import { StoresModule } from 'src/modules/stores';
import { User, UserSchema } from 'src/modules/users/schemas';
import { UsersModule } from 'src/modules/users/users.module';
import { SeedService } from './seed.service';

/**
 * A minimal application context for CLI seeding. It reuses the real feature
 * modules, so seeded data goes through exactly the same validation as
 * production writes; the extra models registered here exist only so `--fresh`
 * can clear the collections.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    UsersModule,
    StoresModule,
    CategoriesModule,
    InventoryModule,
    ProductsModule,
    // Delivery brings the pricing rule model and the engine that validates it;
    // addresses and payments are registered so `--fresh` can clear them.
    AddressesModule,
    DeliveryModule,
    PaymentsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
