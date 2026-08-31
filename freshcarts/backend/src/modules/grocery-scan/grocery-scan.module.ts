import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartModule } from 'src/modules/cart/cart.module';
import { Product, ProductSchema } from 'src/modules/products/schemas';
import { StoresModule } from 'src/modules/stores';
import { AiOcrClient } from './ai/ai-ocr.client';
import { GroceryScanController } from './grocery-scan.controller';
import { GroceryScanService } from './grocery-scan.service';
import { ProductMatcherService } from './matching/product-matcher.service';
import { ScanRateLimitGuard } from './scan-rate-limit.guard';

/**
 * The grocery-list scanner.
 *
 * Composes rather than owns: no collection of its own, no second cart, no
 * second notion of what a product is. It contributes exactly two things the
 * application did not already have — a client for the AI service, and the
 * matching rules that turn "1 kg cheeni" into a FreshCarts product.
 *
 * The Product model is registered directly rather than going through
 * ProductsService because matching needs `searchTerms`, which the public
 * product view deliberately omits, and a bespoke aggregation that joins stock
 * for a whole list in one query. Everything that spends money or changes state
 * still goes through CartService.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    CartModule,
    StoresModule,
  ],
  controllers: [GroceryScanController],
  providers: [AiOcrClient, ProductMatcherService, GroceryScanService, ScanRateLimitGuard],
  exports: [GroceryScanService],
})
export class GroceryScanModule {}
