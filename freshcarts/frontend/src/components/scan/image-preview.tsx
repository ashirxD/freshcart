'use client';

import { useEffect, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';

export interface ImagePreviewProps {
  file: File;
  onRetake: () => void;
  onRemove: () => void;
  onContinue: () => void;
}

/**
 * The "is this the right photo?" step (§46).
 *
 * Worth its own screen: OCR takes seconds and costs real work, and a shopper
 * who can see the photo first catches the blurry one, the upside-down one and
 * the one of the wrong page before any of that is spent.
 *
 * The image is displayed from an object URL, which is revoked when the file
 * changes or the component unmounts — without that, every retake leaks the
 * previous photo's blob for the life of the tab.
 */
export function ImagePreview({ file, onRetake, onRemove, onContinue }: ImagePreviewProps) {
  const t = useT();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <section aria-labelledby="preview-heading" className="gap-loose flex flex-col">
      <header className="flex flex-col gap-1">
        <h1 id="preview-heading" className="text-text text-xl font-bold">
          {t('ocr.preview.title')}
        </h1>
        <p className="text-text-muted text-sm">
          {t('ocr.preview.body')}
        </p>
      </header>

      <div className="bg-surface-sunken ring-outline-variant overflow-hidden rounded-2xl ring-1">
        {objectUrl ? (
          // A plain <img>: this is a local blob, so there is nothing for the
          // Next image optimiser to do and its remote-host allowlist does not
          // apply to blob: URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={objectUrl}
            alt={t('ocr.preview.alt')}
            // Bounded by the viewport height so a tall portrait photo cannot
            // push the buttons off the bottom of a phone screen (§46).
            className="max-h-[55dvh] w-full object-contain"
          />
        ) : null}
      </div>

      <div className="gap-tight flex flex-col">
        <Button size="lg" fullWidth onClick={onContinue}>
          {t('ocr.preview.read')}
        </Button>

        <div className="gap-tight flex">
          <Button
            variant="outline"
            fullWidth
            onClick={onRetake}
            leadingIcon={<Camera className="size-4" />}
          >
            {t('ocr.preview.retake')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={onRemove}
            leadingIcon={<Trash2 className="size-4" />}
          >
            {t('ocr.preview.remove')}
          </Button>
        </div>
      </div>
    </section>
  );
}
