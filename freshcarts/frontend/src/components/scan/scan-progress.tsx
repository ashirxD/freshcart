'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useT, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/cn';

/**
 * The stages a shopper is told about while their list is read (§77).
 *
 * Friendly language, no implementation detail: "Reading your list", never
 * "Calling FastAPI" or "Running Tesseract". Somebody photographing a shopping
 * list does not need to know our architecture, and telling them makes a simple
 * thing feel complicated.
 */
const STAGES: ReadonlyArray<{ id: string; label: TranslationKey }> = [
  { id: 'reading', label: 'ocr.progress.stageReading' },
  { id: 'finding', label: 'ocr.progress.stageFinding' },
  { id: 'matching', label: 'ocr.progress.stageMatching' },
];

/**
 * Roughly how long each stage takes, from measured OCR runs on phone photos.
 *
 * These advance the LABEL only. There is no percentage anywhere on this screen,
 * because the backend reports no progress and inventing one is not acceptable.
 * What the shopper sees is which stage we are on — which is true — and a
 * scanning animation, which is honest about not knowing how long is left.
 */
const STAGE_DURATIONS_MS = [2_000, 2_500];

export function ScanProgress({ file }: { file?: File }) {
  const t = useT();
  const [stage, setStage] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (stage >= STAGES.length - 1) return;

    const timer = setTimeout(() => setStage((current) => current + 1), STAGE_DURATIONS_MS[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  // The shopper's own photo, from an object URL that is revoked when the screen
  // goes away — the same care `ImagePreview` takes, for the same reason.
  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPhotoUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div
      className="gap-loose py-wide flex flex-col items-center"
      // The whole block is announced when it appears, and again as stages
      // change, so a screen-reader user is not left in silence.
      role="status"
      aria-live="polite"
    >
      {/*
        The shopper's own list with a reading line travelling down it, rather
        than a spinner. A spinner says "something is happening"; this says "we
        are reading YOUR list", which is the one thing worth communicating while
        a shopper waits (§32, §77) — and it is their photograph, so nothing
        pretends to be their handwriting. Before the photo is ready, or when
        there is none, it is a sheet of abstract lines instead.
      */}
      <div
        aria-hidden="true"
        className="ring-sand bg-surface shadow-card relative h-48 w-36 overflow-hidden rounded-xl ring-1"
      >
        {photoUrl ? (
          // A local blob: nothing for the Next image optimiser to do.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex flex-col gap-2.5 p-3.5 pt-5">
            {[10, 8, 11, 7, 9, 6].map((width, index) => (
              <span
                key={index}
                className="bg-sand h-1.5 rounded-full"
                style={{ width: width * 8 + '%' }}
              />
            ))}
          </div>
        )}

        <span
          className="animate-sweep absolute inset-x-0 top-0 h-14"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-leaf) 28%, transparent))',
            borderBottom: '2px solid var(--color-leaf)',
          }}
        />
      </div>

      <ol className="gap-tight flex w-full max-w-xs flex-col">
        {STAGES.map((entry, index) => {
          const isDone = index < stage;
          const isCurrent = index === stage;

          return (
            <li
              key={entry.id}
              className={cn(
                'gap-tight flex items-center text-sm',
                isCurrent
                  ? 'text-text font-bold'
                  : isDone
                    ? 'text-text-muted font-medium'
                    : 'text-outline',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full',
                  isDone
                    ? 'bg-leaf text-on-primary'
                    : isCurrent
                      ? 'ring-primary ring-2'
                      : 'ring-outline-variant ring-2',
                )}
                aria-hidden="true"
              >
                {isDone ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : isCurrent ? (
                  <span className="bg-primary size-2 animate-pulse rounded-full" />
                ) : null}
              </span>

              {t(entry.label)}
            </li>
          );
        })}
      </ol>

      <p className="text-text-muted px-page max-w-sm text-center text-sm">
        {t('ocr.progress.takes')}
      </p>
    </div>
  );
}
