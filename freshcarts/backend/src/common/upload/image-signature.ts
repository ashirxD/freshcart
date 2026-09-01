/**
 * IMAGE IDENTIFICATION BY CONTENT, NOT BY CLAIM
 * =============================================
 *
 * Shared by every path in FreshCarts that accepts an uploaded image: the
 * grocery-list scanner, and product photography in the back office.
 *
 * WHAT IS NOT TRUSTED: the filename, the extension, or the Content-Type header.
 * All three are chosen by the caller. `product.jpg` containing a shell script
 * has the right name, the right extension and whatever Content-Type the client
 * felt like sending — and none of those bytes at offset zero.
 *
 * This lives in `common/` rather than inside one feature because two features
 * now need it, and a second copy of a security check is a second thing to
 * forget to update.
 */

/**
 * The subset of multer's file object this code uses.
 *
 * Declared here rather than pulling in `@types/multer`: four fields against a
 * dependency, and this keeps the shape the code actually relies on visible.
 */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Content types a phone camera or a screenshot actually produces. */
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * File signatures for the formats above.
 */
const MAGIC_BYTES: Array<{ mime: string; offset: number; bytes: number[]; suffix?: number[] }> = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP: "RIFF" .... "WEBP" — the format marker is at offset 8, not 0.
  {
    mime: 'image/webp',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    suffix: [0x57, 0x45, 0x42, 0x50],
  },
];

const WEBP_SUFFIX_OFFSET = 8;

/** Detects the true format of a buffer, or null when it is not an image. */
export function detectImageType(buffer: Buffer): string | null {
  for (const signature of MAGIC_BYTES) {
    if (buffer.length < signature.offset + signature.bytes.length) continue;

    const matches = signature.bytes.every(
      (byte, index) => buffer[signature.offset + index] === byte,
    );

    if (!matches) continue;

    if (signature.suffix) {
      if (buffer.length < WEBP_SUFFIX_OFFSET + signature.suffix.length) continue;
      const suffixMatches = signature.suffix.every(
        (byte, index) => buffer[WEBP_SUFFIX_OFFSET + index] === byte,
      );
      if (!suffixMatches) continue;
    }

    return signature.mime;
  }

  return null;
}

/** The file extension to store a verified image under. Never the client's. */
export function extensionFor(contentType: string): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType] ?? 'bin';
}
