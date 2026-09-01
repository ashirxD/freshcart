import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { LocalMediaStorage, MediaStorage } from './media-storage';

/**
 * Product photography.
 *
 * The implementation is bound to the abstract `MediaStorage` token, so every
 * consumer depends on the contract rather than on local disk. Swapping to
 * object storage later is a new class and one line here.
 */
@Module({
  controllers: [MediaController],
  providers: [{ provide: MediaStorage, useClass: LocalMediaStorage }],
  exports: [MediaStorage],
})
export class MediaModule {}
