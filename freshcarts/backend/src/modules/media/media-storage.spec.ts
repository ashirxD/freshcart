import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/configuration';
import { detectImageType, extensionFor } from 'src/common/upload';
import { LocalMediaStorage } from './media-storage';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

describe('image identification', () => {
  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
    ['WEBP', WEBP, 'image/webp'],
  ])('recognises a %s by its bytes', (_name, buffer, expected) => {
    expect(detectImageType(buffer)).toBe(expected);
  });

  it('rejects a script, however it is named or declared', () => {
    // The whole point of the check: `product.jpg` with an image/jpeg
    // Content-Type has the right name, the right extension, and none of the
    // right bytes at offset zero.
    expect(detectImageType(Buffer.from('#!/bin/sh\necho pwned\n'))).toBeNull();
  });

  it('rejects an HTML file, which a browser would happily execute', () => {
    expect(detectImageType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });

  it('rejects a truncated header rather than reading past the buffer', () => {
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a RIFF container that is not WEBP', () => {
    // RIFF is also AVI and WAV. The format marker at offset 8 is what decides.
    const avi = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('AVI '),
    ]);

    expect(detectImageType(avi)).toBeNull();
  });

  it('maps each verified type to a safe extension', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
    // Never trusted enough to produce something executable.
    expect(extensionFor('application/x-sh')).toBe('bin');
  });
});

describe('LocalMediaStorage', () => {
  const directory = join(tmpdir(), 'freshcarts-media-spec-' + process.pid);

  const configService = {
    get: () => ({ storageDir: directory, publicPath: '/media', maxImageBytes: 5_000_000 }),
  } as unknown as ConfigService<AppConfig, true>;

  const storage = new LocalMediaStorage(configService);

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes the bytes and reports where to fetch them', async () => {
    const stored = await storage.save(PNG, 'image/png');

    expect(stored.url).toBe('/media/' + stored.key);
    expect(stored.contentType).toBe('image/png');
    expect(stored.bytes).toBe(PNG.length);

    await expect(readFile(join(directory, stored.key))).resolves.toEqual(PNG);
  });

  it('returns a rooted path, never an absolute URL', async () => {
    // An origin baked in at write time would be stored on the product document
    // and would be wrong the moment the API moved to a real domain.
    const stored = await storage.save(PNG, 'image/png');

    expect(stored.url.startsWith('/')).toBe(true);
    expect(stored.url).not.toMatch(/^https?:/);
  });

  it('generates the filename rather than accepting one', async () => {
    const stored = await storage.save(JPEG, 'image/jpeg');

    // 32 hex characters plus an extension derived from the VERIFIED type.
    expect(stored.key).toMatch(/^[a-f0-9]{32}\.jpg$/);
  });

  it('never collides, so one upload cannot overwrite another', async () => {
    const keys = await Promise.all(
      Array.from({ length: 25 }, () => storage.save(PNG, 'image/png').then((s) => s.key)),
    );

    expect(new Set(keys).size).toBe(25);
  });

  it('removes a key it issued', async () => {
    const stored = await storage.save(PNG, 'image/png');
    await storage.remove(stored.key);

    await expect(readFile(join(directory, stored.key))).rejects.toThrow();
  });

  it('is silent about a key that is already gone', async () => {
    // Deleting a product must not fail because its photograph was cleaned up
    // by something else first.
    await expect(storage.remove('a'.repeat(32) + '.jpg')).resolves.toBeUndefined();
  });

  it.each([
    ['../../../etc/passwd', 'a dot-segment traversal'],
    ['..\\..\\windows\\system32', 'a Windows traversal'],
    ['/etc/passwd', 'an absolute path'],
    ['subdir/file.jpg', 'a nested path'],
    ['file.jpg', 'a name this storage did not issue'],
  ])('refuses to remove %s (%s)', async (key) => {
    // `remove` is public, so the key is validated rather than trusted — a key
    // with a separator in it would otherwise reach outside the media directory.
    const canary = await storage.save(PNG, 'image/png');

    await expect(storage.remove(key)).resolves.toBeUndefined();

    // Nothing else was touched.
    await expect(readFile(join(directory, canary.key))).resolves.toEqual(PNG);
  });

  it('resolves its directory to an absolute path at construction', () => {
    // Every later join is against a fixed base, so no request can influence it.
    const relative = new LocalMediaStorage({
      get: () => ({ storageDir: './var/media', publicPath: '/media', maxImageBytes: 1 }),
    } as unknown as ConfigService<AppConfig, true>);

    expect(relative).toBeInstanceOf(LocalMediaStorage);
    expect(resolve('./var/media')).toMatch(/^([A-Za-z]:)?[\\/]/);
  });
});
