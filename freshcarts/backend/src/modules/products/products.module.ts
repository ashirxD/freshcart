import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from 'src/modules/categories';
import { Cart, CartSchema } from 'src/modules/cart/schemas';
import { Favorite, FavoriteSchema } from 'src/modules/favorites/schemas';
import { InventoryModule } from 'src/modules/inventory';
import { StoresModule } from 'src/modules/stores';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './schemas';

/**
 * Dependency direction: stores -> categories -> inventory -> products -> {cart,
 * favourites}. Products therefore imports the modules below it and registers the
 * cart/favourite *models* (read-only) purely for the delete-safety guard, which
 * keeps the graph acyclic.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Favorite.name, schema: FavoriteSchema },
    ]),
    StoresModule,
    CategoriesModule,
    InventoryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, MongooseModule],
})
export class ProductsModule {}
