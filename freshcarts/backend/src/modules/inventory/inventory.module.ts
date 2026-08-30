import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoresModule } from 'src/modules/stores';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { Inventory, InventorySchema } from './schemas';

/**
 * Depends on nothing in the catalogue, so products, cart and favourites can all
 * ask it for stock without a cycle. The admin listing joins the product
 * collection by name in an aggregation rather than importing ProductsModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Inventory.name, schema: InventorySchema }]),
    StoresModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
