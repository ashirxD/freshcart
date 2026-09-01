/**
 * Upload handling for grocery-list photos (§5, §6, §40).
 *
 * THE FILE NEVER TOUCHES DISK
 *
 * Multer is configured with memory storage explicitly. That single decision
 * removes an entire class of vulnerability from this feature: there is no
 * filename to sanitise, no directory to traverse out of, no temporary file to
 * leak or forget to delete, and no path an attacker can influence. The buffer
 * lives for the length of one request and is then garbage.
 *
 * It is set explicitly rather than relied on as multer's default, because a
 * security property that holds by accident is one library upgrade away from not
 * holding.
 *
 * WHAT IS TRUSTED
 *
 * Not the filename. Not the extension. Not the Content-Type header — all three
 * are chosen by the caller. The magic bytes are checked here, and the AI
 * service decodes the image and checks the format again. Two independent
 * checks, because this one runs in the process that would be compromised.
 */

import { memoryStorage } from 'multer';
import { BusinessException } from 'src/common/errors';
import { ALLOWED_MIME_TYPES, detectImageType, type UploadedImage } from 'src/common/upload';

/**
 * Image identification lives in `common/upload` now, because product
 * photography needs the same check. Re-exported here so every existing import
 * of this module keeps working, and so the scanner's own code reads unchanged.
 */
export { ALLOWED_MIME_TYPES, detectImageType, type UploadedImage } from 'src/common/upload';

/** Multer options for the scan endpoint. */
export function scanUploadOptions(maxBytes: number) {
  return {
    // Explicit. See the note above on why this is not left to a default.
    storage: memoryStorage(),
    limits: {
      fileSize: maxBytes,
      // Exactly one file, one field. A multipart body with fifty parts is not
      // a grocery list, and parsing it would be work done on an attacker's
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
      // bytes are buffered. The real check is assertIsImage, below.
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        callback(
          BusinessException.imageInvalid('Please upload a photo in JPG, PNG or WEBP format.'),
          false,
        );
        return;
      }

      callback(null, true);
    },
  };
}

/** A verified upload: bytes that really are an image of the type reported. */
export interface VerifiedImage {
  buffer: Buffer;
  /** The type detected from the BYTES, not the one the client declared. */
  contentType: string;
}

/**
 * Validates an upload and hands back the bytes with their true type.
 *
 * Returns the pair rather than just the type so a caller cannot end up holding
 * a possibly-undefined file it has "already checked" — the only way to obtain
 * the buffer is to go through this function, which makes the check impossible
 * to skip and removes the non-null assertion that would otherwise sit at the
 * call site.
 *
 * Throws a BusinessException the exception filter already knows how to render,
 * so the shopper sees a sentence rather than a framework error.
 */
export function assertIsImage(file: UploadedImage | undefined, maxBytes: number): VerifiedImage {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw BusinessException.imageInvalid('Please choose a photo of your grocery list first.');
  }

  if (file.size > maxBytes || file.buffer.length > maxBytes) {
    throw BusinessException.imageTooLarge(maxBytes);
  }

  const detected = detectImageType(file.buffer);

  if (detected === null) {
    throw BusinessException.imageInvalid(
      'That file is not a photo we can read. Please upload a JPG, PNG or WEBP image.',
    );
  }

  // The detected type is what gets forwarded, not the declared one. Downstream
  // never sees a claim this process has not verified.
  return { buffer: file.buffer, contentType: detected };
}

/**
 * A safe filename for the multipart part sent onward.
 *
 * The shopper's own filename is discarded entirely rather than sanitised.
 * Sanitising is a game of finding every dangerous form; replacing removes the
 * question — and the name carries no information anyone needs.
 */
export function safeFilename(contentType: string): string {
  const extension = contentType.split('/')[1] ?? 'bin';
  return 'grocery-list.' + extension.replace(/[^a-z0-9]/gi, '');
}
