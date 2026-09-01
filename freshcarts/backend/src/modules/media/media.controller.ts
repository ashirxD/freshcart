import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from 'src/common/decorators';
import { AppConfig } from 'src/common/config/configuration';
import { Role } from 'src/common/enums';
import { BusinessException } from 'src/common/errors';
import { ALLOWED_MIME_TYPES, detectImageType, type UploadedImage } from 'src/common/upload';
import { MediaStorage } from './media-storage';

/**
 * A hard ceiling, independent of configuration.
 *
 * The configured limit governs what the product form should accept; this is the
 * point past which multer stops buffering at all. Set above the configured
 * value so the friendly BusinessException below is what a shopkeeper normally
 * sees, rather than a framework error from the parser.
 */
const ABSOLUTE_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * PRODUCT PHOTOGRAPHY UPLOAD
 * ==========================
 *
 * ADMIN-only, and one file per request. The bytes are buffered in memory,
 * verified by their magic bytes, and only then written under a generated name —
 * the client's filename never reaches the filesystem.
 *
 * Uploading is deliberately a separate request from creating the product. A
 * shopkeeper on a patchy connection can lose a product form to a failed photo
 * upload otherwise, and re-typing twenty fields because one image timed out is
 * the kind of thing that stops people using the back office at all. Here the
 * photo uploads as soon as it is chosen, the form holds only the returned URL,
 * and a failure costs one retry of one image.
 *
 * The trade-off, stated plainly: an image uploaded for a product that is never
 * saved stays on disk unreferenced. That is a cleanup job worth writing when
 * there is enough of it to matter, and it is the right way round — an orphaned
 * file is cheap, a lost form is not.
 */
@Controller('admin/media')
@Roles(Role.ADMIN)
export class MediaController {
  private readonly maxBytes: number;

  constructor(
    private readonly storage: MediaStorage,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.maxBytes = configService.get('media', { infer: true }).maxImageBytes;
  }

  @Post('product-image')
  @UseInterceptors(
    FileInterceptor('image', {
      // Explicit, not multer's default: a security property that holds by
      // accident is one library upgrade away from not holding.
      storage: memoryStorage(),
      limits: {
        fileSize: ABSOLUTE_MAX_UPLOAD_BYTES,
        // One file, one field. A multipart body with fifty parts is not a
        // product photo, and parsing it would be work done on an attacker's
        // behalf.
        files: 1,
        fields: 1,
        parts: 2,
      },
      fileFilter: (
        _request: unknown,
        file: { mimetype: string },
        callback: (error: Error | null, accept: boolean) => void,
      ) => {
        // A cheap first pass so an obviously wrong upload is refused before its
        // bytes are buffered. The real check is the magic bytes, below.
        if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            BusinessException.imageInvalid('Please upload a photo in JPG, PNG or WEBP format.'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async uploadProductImage(@UploadedFile() file: UploadedImage | undefined) {
    if (!file?.buffer?.length) {
      throw BusinessException.imageInvalid('Please choose a photo first.');
    }

    if (file.buffer.length > this.maxBytes) {
      throw BusinessException.imageTooLarge(this.maxBytes);
    }

    // The type comes from the BYTES, not from anything the client declared, and
    // it is what decides the stored extension.
    const contentType = detectImageType(file.buffer);

    if (contentType === null) {
      throw BusinessException.imageInvalid(
        'That file is not a photo we can read. Please upload a JPG, PNG or WEBP image.',
      );
    }

    return this.storage.save(file.buffer, contentType);
  }
}
