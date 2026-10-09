'use client';

import { useCallback, useState } from 'react';
import { Container } from '@/components/layout/container';
import { ImagePicker } from '@/components/scan/image-picker';
import { ImagePreview } from '@/components/scan/image-preview';
import { ScanEmptyResult, ScanFailure } from '@/components/scan/scan-failure';
import { ScanOutcome } from '@/components/scan/scan-outcome';
import { ScanProgress } from '@/components/scan/scan-progress';
import { ScanReview } from '@/components/scan/scan-review';
import { ButtonLink } from '@/components/ui/button-link';
import { useConfirmScan, useScanGroceryList } from '@/features/scan/scan.hooks';
import { useScanSelection } from '@/features/scan/use-scan-selection';
import { useT } from '@/i18n';
import { describeError } from '@/lib/api/error-copy';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';
import type { ScanConfirmation, ScanResult } from '@/types/scan';

/**
 * Mirrors SCAN_MAX_IMAGE_BYTES on the server.
 *
 * A convenience, not a control: it catches an obviously oversized photo before
 * it is uploaded over mobile data. The server enforces the real limit, on the
 * bytes, and rejects anything past it regardless of what this thinks.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * The stages of the flow (§44).
 *
 * A single union rather than a scatter of booleans: `isUploading && !error &&
 * result` is the kind of expression that produces two states on screen at once,
 * and this makes every stage mutually exclusive by construction.
 */
type Stage =
  | { name: 'idle' }
  | { name: 'selected'; file: File }
  | { name: 'processing'; file: File }
  | { name: 'reviewing'; result: ScanResult }
  | { name: 'added'; outcome: ScanConfirmation; result: ScanResult }
  | { name: 'failed'; error: unknown };

export function ScanScreen() {
  const t = useT();
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const [rejection, setRejection] = useState<string | null>(null);
  const toast = useToast();

  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.user?.role);

  const scan = useScanGroceryList();
  const confirm = useConfirmScan();

  // The review state lives here rather than inside ScanReview, so it survives
  // the trip to the outcome screen and back — a shopper resolving the leftover
  // items must not find their earlier choices reset.
  const reviewResult =
    stage.name === 'reviewing' ? stage.result : stage.name === 'added' ? stage.result : null;
  const selection = useScanSelection(reviewResult);

  const reset = useCallback(() => {
    setRejection(null);
    setStage({ name: 'idle' });
  }, []);

  const submit = useCallback(
    (file: File) => {
      setStage({ name: 'processing', file });

      scan.mutate(file, {
        onSuccess: (result) => setStage({ name: 'reviewing', result }),
        onError: (error) => setStage({ name: 'failed', error }),
      });
    },
    [scan],
  );

  const addAll = useCallback(() => {
    if (stage.name !== 'reviewing') return;

    const items = selection.toConfirmInput();
    if (items.length === 0) return;

    confirm.mutate(
      { items },
      {
        onSuccess: (outcome) => {
          setStage({ name: 'added', outcome, result: stage.result });

          // Mark what made it, so returning to the review screen shows the
          // finished lines as done and leaves only what still needs sorting.
          selection.markAdded(outcome.added.map((entry) => entry.productId));
        },
        onError: (error) => {
          toast({
            title: t('ocr.screen.addFailed'),
            description:
              error instanceof Error ? describeError(error, t) : t('errors.checkConnection'),
            variant: 'error',
          });
        },
      },
    );
  }, [confirm, selection, stage, t, toast]);

  if (status === 'loading') {
    return (
      <Container className="py-loose">
        <p className="text-text-muted text-sm">{t('common.loading')}</p>
      </Container>
    );
  }

  if (status !== 'authenticated' || role !== 'CUSTOMER') {
    return (
      <Container className="gap-loose py-loose flex flex-col items-center text-center">
        <h1 className="text-text text-xl font-bold">{t('ocr.screen.signInTitle')}</h1>
        <p className="text-text-muted text-sm">{t('ocr.screen.signInBody')}</p>
        <ButtonLink href="/login?next=/scan">{t('nav.signIn')}</ButtonLink>
      </Container>
    );
  }

  return (
    <div>
      <Container className="py-loose max-w-2xl">
        {stage.name === 'idle' ? (
          <ImagePicker
            maxBytes={MAX_IMAGE_BYTES}
            rejection={rejection}
            onSelect={(file) => {
              setRejection(null);
              setStage({ name: 'selected', file });
            }}
            onReject={(message) => {
              setRejection(message);
              toast({ title: message, variant: 'error' });
            }}
          />
        ) : null}

        {stage.name === 'selected' ? (
          <ImagePreview
            file={stage.file}
            onRetake={reset}
            onRemove={reset}
            onContinue={() => submit(stage.file)}
          />
        ) : null}

        {stage.name === 'processing' ? <ScanProgress file={stage.file} /> : null}

        {stage.name === 'reviewing' ? (
          stage.result.items.length === 0 ? (
            // §58: the photo was readable and there were no groceries on it —
            // a different screen from "we could not read that photo".
            <ScanEmptyResult onRetry={reset} />
          ) : (
            <ScanReview
              result={stage.result}
              selection={selection}
              isAdding={confirm.isPending}
              onAddAll={addAll}
              onRescan={reset}
            />
          )
        ) : null}

        {stage.name === 'added' ? (
          <ScanOutcome
            outcome={stage.outcome}
            remainingCount={
              selection.lines.filter((line) => !line.removed && !line.addedToCart).length
            }
            onScanAnother={reset}
            onReviewRemaining={() => setStage({ name: 'reviewing', result: stage.result })}
          />
        ) : null}

        {stage.name === 'failed' ? <ScanFailure error={stage.error} onRetry={reset} /> : null}
      </Container>
    </div>
  );
}
