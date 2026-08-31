import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IDEMPOTENCY_KEY_MODEL, IdempotencyKeySchema } from './idempotency-key.schema';
import { IdempotencyService } from './idempotency.service';

/**
 * Cross-cutting infrastructure rather than a feature: any endpoint that creates
 * something a client might retry can claim a key, which is why this lives under
 * common/ and is imported by the modules that need it rather than owning one.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: IDEMPOTENCY_KEY_MODEL, schema: IdempotencyKeySchema }]),
  ],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
