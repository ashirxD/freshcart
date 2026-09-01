/**
 * DOWNSCALING BEFORE UPLOAD
 * =========================
 *
 * A shopkeeper photographs a shelf with their phone and gets a 4–8 MB image
 * several thousand pixels wide. Two things go wrong if that is stored as-is:
 * the upload itself is slow and fails on a patchy connection, and every shopper
 * afterwards pays to download it over mobile data to fill a 400px card.
 *
 * Resizing in the browser fixes both, and the first one is the reason it
 * happens here rather than on the server: bytes that are never sent cost the
 * shopkeeper nothing. A server-side resize would still make them upload the
 * full 8 MB first.
 *
 * THIS IS A CONVENIENCE, NOT A CONTROL. The API independently enforces its own
 * size ceiling and identifies the format from the file's magic bytes, because
 * anything a browser does can be skipped by not using a browser.
 */

/** Wide enough for a full-bleed product image on a desktop display. */
const MAX_EDGE_PX = 1400;

/** JPEG quality. 0.82 is the point where artefacts stop being visible on photos. */
const QUALITY = 0.82;

export interface PreparedImage {
  file: File;
  /** An object URL for previewing. The caller must revoke it. */
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Reads an image file, scales it to fit within {@link MAX_EDGE_PX}, and returns
 * a new JPEG file ready to upload.
 *
 * Falls back to the original file whenever anything goes wrong — an unusual
 * codec, a browser without canvas, an image too large to decode. A slightly
 * heavy upload is a much better outcome than refusing the shopkeeper's photo,
 * and the server enforces the real limit either way.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    // Already small enough, and already a format the API accepts: leave it be
    // rather than re-encoding, which would only lose quality.
    if (scale === 1 && file.size <= 1_000_000 && file.type === 'image/jpeg') {
      bitmap.close();
      return { file, previewUrl: URL.createObjectURL(file), width, height };
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');

    // Photographs, not line art: bilinear smoothing is what we want here.
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );

    if (!blob) throw new Error('encoding failed');

    // The name is cosmetic — the API generates the stored filename — but a
    // sensible one makes the browser's own file picker readable.
    const resized = new File([blob], renameToJpeg(file.name), { type: 'image/jpeg' });

    return { file: resized, previewUrl: URL.createObjectURL(resized), width, height };
  } catch {
    return { file, previewUrl: URL.createObjectURL(file), width: 0, height: 0 };
  }
}

function renameToJpeg(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return base.slice(0, 60) + '.jpg';
}

/**
 * Turns a stored image path into something an `<img>` can load.
 *
 * Uploaded images are stored as a rooted path (`/media/<key>.jpg`) rather than
 * an absolute URL, deliberately: the API's origin differs between development
 * and production, and a value baked in at write time would be wrong in one of
 * them. That means the browser has to be told which origin to resolve it
 * against, and this is the one place that decision is made.
 */
export function resolveImageUrl(url: string, apiOrigin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  return apiOrigin.replace(/\/+$/, '') + url;
}
