import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from 'src/common/config/configuration';
import { validateEnv } from 'src/common/config/env.validation';
import { DatabaseSupportModule } from 'src/common/database';
import { AllExceptionsFilter } from 'src/common/filters';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards';
import { DatabaseModule } from 'src/database/database.module';
import { AddressesModule } from 'src/modules/addresses';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CartModule } from 'src/modules/cart/cart.module';
import { CategoriesModule } from 'src/modules/categories';
import { CheckoutModule } from 'src/modules/checkout';
import { DeliveryModule } from 'src/modules/delivery';
import { FavoritesModule } from 'src/modules/favorites/favorites.module';
import { GroceryScanModule } from 'src/modules/grocery-scan';
import { HealthModule } from 'src/modules/health/health.module';
import { InventoryModule } from 'src/modules/inventory';
import { OrdersModule } from 'src/modules/orders';
import { PaymentsModule } from 'src/modules/payments';
import { ProductsModule } from 'src/modules/products';
import { StoreManagerModule } from 'src/modules/store-manager';
import { StoresModule } from 'src/modules/stores';
import { SubstitutionsModule } from 'src/modules/substitutions';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const throttle = configService.get('throttle', { infer: true });
        return { throttlers: [{ ttl: throttle.ttl, limit: throttle.limit }] };
      },
    }),
    DatabaseModule,
    // Provides the unit-of-work boundary every multi-collection write uses.
    DatabaseSupportModule,
    AuthModule,
    UsersModule,
    HealthModule,
    // Catalogue, in dependency order: stores scope categories and products,
    // inventory backs availability, and cart/favourites build on products.
    StoresModule,
    CategoriesModule,
    InventoryModule,
    ProductsModule,
    CartModule,
    FavoritesModule,
    // Purchase flow, in dependency order: addresses and delivery answer "where
    // and how much", payments answers "how", checkout validates and prices, and
    // orders is the only thing that persists a commitment.
    AddressesModule,
    DeliveryModule,
    PaymentsModule,
    CheckoutModule,
    OrdersModule,
    // The AI grocery-list scanner. Sits on top of the catalogue and the cart
    // and owns no data of its own; when the AI service is down, only this
    // degrades and the rest of FreshCarts is unaffected.
    GroceryScanModule,
    // Store operations. Sits at the top of the graph and owns no schema of its
    // own beyond the substitution record: every read and write is delegated to
    // the domain service that already owns it, scoped to the manager's store.
    SubstitutionsModule,
    StoreManagerModule,
  ],
  providers: [
    // Order matters: rate limit first, then authenticate, then authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
