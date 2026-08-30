import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from 'src/common/config/configuration';
import { validateEnv } from 'src/common/config/env.validation';
import { AllExceptionsFilter } from 'src/common/filters';
import { JwtAuthGuard, RolesGuard } from 'src/common/guards';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CartModule } from 'src/modules/cart/cart.module';
import { CategoriesModule } from 'src/modules/categories';
import { FavoritesModule } from 'src/modules/favorites/favorites.module';
import { HealthModule } from 'src/modules/health/health.module';
import { InventoryModule } from 'src/modules/inventory';
import { ProductsModule } from 'src/modules/products';
import { StoresModule } from 'src/modules/stores';
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
