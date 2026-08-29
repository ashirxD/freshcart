'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore, type ToastVariant } from '@/store/toast.store';

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ACCENTS: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-secondary',
};

/**
 * Rendered once in the root layout. Sits above the bottom navigation on mobile
 * so a confirmation never covers the tab the shopper is about to tap.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      // Announced by screen readers without stealing focus.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-xs px-page sm:bottom-6 sm:items-end"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant];

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3',
              'rounded-md border border-outline-variant bg-surface p-gutter shadow-raised',
            )}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', ACCENTS[toast.variant])} aria-hidden="true" />

            <div className="flex-1">
              <p className="text-sm font-medium text-text">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-sm text-text-muted">{toast.description}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-m-1 rounded-full p-1 text-outline hover:bg-surface-muted"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
