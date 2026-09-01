import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/configuration';
import { extensionFor } from 'src/common/upload';

/** A stored file, as the API reports it back to the client. */
export interface StoredImage {
  /**
   * The path the browser fetches. Relative to the API origin, never absolute:
   * the API may be reached on localhost in development and on a real domain in
   * production, and a URL baked in at write time would be wrong in one of them.
   */
  url: string;
  /** The storage key, for deletion. Never derived from client input. */
  key: string;
  contentType: string;
  bytes: number;
}

/**
 * WHERE PRODUCT PHOTOGRAPHY LIVES
 * ===============================
 *
 * An interface with one implementation, and that is deliberate rather than
 * speculative: object storage is the correct answer in production and local
 * disk is the only answer that works with no account, no credentials and no
 * network. Naming the seam now means the switch is a provider swap plus an
 * environment variable, exactly as the routing provider already works — not a
 * rewrite of every call site.
 *
 * No S3 implementation is written here, because one that cannot be run or
 * tested is a liability rather than an asset.
 */
export abstract class MediaStorage {
  /** Persists verified image bytes and returns how to reach them. */
  abstract save(buffer: Buffer, contentType: string): Promise<StoredImage>;

  /** Best-effort removal. A missing key is not an error. */
  abstract remove(key: string): Promise<void>;
}

/**
 * Local-disk storage.
 *
 * THE FILENAME IS GENERATED, NEVER ACCEPTED. The client's filename is discarded
 * entirely rather than sanitised — sanitising is a game of finding every
 * dangerous form, and the name carries no information anyone needs. A random
 * 16-byte name plus an extension derived from the VERIFIED content type means
 * there is no path to traverse, no extension to smuggle, and no collision to
 * worry about.
 *
 * DEPLOYMENT NOTE: this writes to the filesystem of the process. In a container
 * that means the directory must be a mounted volume, or every image vanishes on
 * the next deploy. See MEDIA_STORAGE_DIR in .env.example.
 */
@Injectable()
export class LocalMediaStorage extends MediaStorage {
  private readonly logger = new Logger(LocalMediaStorage.name);

  private readonly directory: string;
  private readonly publicPath: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    super();

    const media = configService.get('media', { infer: true });
    // Resolved once, at construction, so every later join is against an
    // absolute base that no request can influence.
    this.directory = resolve(media.storageDir);
    this.publicPath = media.publicPath;
  }

  async save(buffer: Buffer, contentType: string): Promise<StoredImage> {
    await mkdir(this.directory, { recursive: true });

    const key = randomBytes(16).toString('hex') + '.' + extensionFor(contentType);

    await writeFile(join(this.directory, key), buffer);
    this.logger.log('Stored image ' + key + ' (' + buffer.length + ' bytes)');

    return {
      url: this.publicPath + '/' + key,
      key,
      contentType,
      bytes: buffer.length,
    };
  }

  async remove(key: string): Promise<void> {
    // The key came from `save`, but this method is public, so it is validated
    // rather than trusted: a key containing a separator or a dot-segment would
    // otherwise reach outside the media directory.
    if (!/^[a-f0-9]{32}\.[a-z0-9]{1,5}$/.test(key)) {
      this.logger.warn('Refusing to remove a key that this storage did not issue');
      return;
    }

    try {
      await unlink(join(this.directory, key));
    } catch {
      // Already gone, or never existed. Deleting a product should not fail
      // because its photograph was cleaned up by something else first.
    }
  }
}
