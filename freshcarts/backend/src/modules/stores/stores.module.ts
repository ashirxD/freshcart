import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Store, StoreSchema } from './schemas';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

/**
 * Owns the store entity and, more importantly, the single answer to "which
 * store is this request about?". Every other catalogue module asks this service
 * rather than carrying its own copy of that rule.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Store.name, schema: StoreSchema }])],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService, MongooseModule],
})
export class StoresModule {}
