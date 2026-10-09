'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/features/admin/admin.api';
import { useI18n } from '@/i18n';
import { describeError } from '@/lib/api/error-copy';
import { ApiError } from '@/lib/api/errors';
import { env } from '@/lib/env';
import { prepareImageForUpload, resolveImageUrl } from '@/lib/image';
import type { ProductImage } from '@/types/catalog';

/** Matches ArrayMaxSize(8) on the server. Stated here so the UI can say so first. */
export const MAX_PRODUCT_IMAGES = 8;

const ACCEPTED = 'image/jpeg,image/png,image/webp';

/**
 * PRODUCT PHOTOGRAPHY
 * ===================
 *
 * Each photo uploads the moment it is chosen and the form keeps only the
 * returned path. That is what stops a slow or failed image from taking a
 * filled-in product form down with it — a failure costs one retry of one
 * photo, not twenty re-typed fields.
 *
 * ALT TEXT IS REQUIRED, and the server enforces it too. An image with no
 * description is invisible to anyone using a screen reader, and on a grocery
 * app the image often IS the product identification.
 *
 * The first image is the one shown on cards and in search results, so ordering
 * is a real decision rather than a nicety — hence the explicit move controls
 * and the "Main photo" marker.
 */
export function ImageUploader({
  images,
  onChange,
  disabled,
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Previews are object URLs and leak until revoked. Held in a ref so the
  // cleanup runs once on unmount rather than on every render.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach(URL.revokeObjectURL), []);

  const remaining = MAX_PRODUCT_IMAGES - images.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    setError(null);
    setUploading(true);

    const chosen = Array.from(files).slice(0, Math.max(0, remaining));
    const added: ProductImage[] = [];

    try {
      for (const file of chosen) {
        // Downscale first: the shopkeeper is often on the same mobile
        // connection as their customers, and this is their upload too.
        const prepared = await prepareImageForUpload(file);
        previews.current.push(prepared.previewUrl);

        const stored = await adminApi.uploadProductImage(prepared.file);

        added.push({
          url: stored.url,
          // Seeded from the filename so the field is rarely empty, but always
          // editable — a filename is a poor description and the admin knows
          // what the product actually is.
          alt: '',
          sortOrder: images.length + added.length,
        });
      }

      onChange([...images, ...added]);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? describeError(cause) : t('admin.uploader.failed'),
      );
    } finally {
      setUploading(false);
      // Allows re-choosing the same file after a failure.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const update = (index: number, patch: Partial<ProductImage>) =>
    onChange(
      images.map((image, position) => (position === index ? { ...image, ...patch } : image)),
    );

  const remove = (index: number) =>
    onChange(
      images
        .filter((_, position) => position !== index)
        .map((image, position) => ({ ...image, sortOrder: position })),
    );

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;

    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((image, position) => ({ ...image, sortOrder: position })));
  };

  return (
    <div className="gap-gutter flex flex-col">
      <div className="gap-gutter flex flex-wrap items-center">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="sr-only"
          id="product-images"
          disabled={disabled || isUploading || remaining <= 0}
          onChange={(event) => void handleFiles(event.target.files)}
        />

        <Button
          type="button"
          variant="outline"
          isLoading={isUploading}
          disabled={disabled || remaining <= 0}
          onClick={() => inputRef.current?.click()}
          leadingIcon={<ImagePlus className="size-4" aria-hidden="true" />}
        >
          {images.length === 0 ? t('admin.uploader.addPhotos') : t('admin.uploader.addMore')}
        </Button>

        <p className="text-text-muted text-sm">
          {remaining > 0
            ? t('admin.uploader.upTo', { count: remaining })
            : t('admin.uploader.maxReached', { max: MAX_PRODUCT_IMAGES })}
        </p>
      </div>

      <p className="text-text-muted text-xs">
        {t('admin.uploader.shrinkNote')}
      </p>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      {isUploading ? (
        <p aria-live="polite" className="text-text-muted flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('admin.uploader.uploading')}
        </p>
      ) : null}

      {images.length === 0 ? (
        <p className="border-sand text-text-muted p-gutter rounded-xl border-2 border-dashed text-center text-sm">
          {t('admin.uploader.none')}
        </p>
      ) : (
        <ul className="gap-gutter flex flex-col">
          {images.map((image, index) => (
            <li
              key={image.url}
              className="ring-outline-variant bg-surface p-gutter gap-gutter flex flex-wrap items-start rounded-xl ring-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the API
                  host is not in next.config remotePatterns by default, and this
                  is a back-office preview of a file that was just uploaded. */}
              <img
                src={resolveImageUrl(image.url, env.apiOrigin)}
                alt=""
                className="bg-surface-sunken size-20 shrink-0 rounded-md object-cover"
              />

              <div className="flex min-w-48 flex-1 flex-col gap-1">
                <Input
                  label={t('admin.uploader.descriptionFor', { n: index + 1 })}
                  placeholder={t('admin.uploader.altPlaceholder')}
                  value={image.alt}
                  maxLength={160}
                  onChange={(event) => update(index, { alt: event.target.value })}
                  hint={
                    index === 0
                      ? t('admin.uploader.altHint')
                      : undefined
                  }
                />

                {index === 0 ? (
                  <p className="text-primary flex items-center gap-1 text-xs font-semibold">
                    <Star className="size-3.5" aria-hidden="true" />
                    {t('admin.uploader.mainPhoto')}
                  </p>
                ) : null}
              </div>

              <div className="gap-tight flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t('admin.uploader.moveEarlier', { n: index + 1 })}
                >
                  <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === images.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t('admin.uploader.moveLater', { n: index + 1 })}
                >
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={t('admin.uploader.remove', { n: index + 1 })}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
