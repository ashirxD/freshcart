'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore, type ToastVariant } from '@/store/toast.store';

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

/**
 * The accent is a filled disc rather than a bare tinted glyph.
 *
 * On a warm page a small coloured icon on white does not register; a disc does,
 * and it lets the message itself stay in plain ink so it is the thing that is
 * actually read.
 */
const ACCENTS: Record<ToastVariant, string> = {
  success: 'bg-leaf/15 text-success',
  error: 'bg-danger/12 text-danger',
  info: 'bg-teal/12 text-info',
};

/**
 * Rendered once in the root layout. Sits above the bottom navigation on mobile
 * so a confirmation never covers the tab the shopper is about to tap, and above
 * the sticky cart bar, which is taller.
 *
 * Each toast slides up as it arrives (`animate-toast-in`) and is dropped from
 * the DOM by the store on a timer — no exit animation, because an element that
 * lingers while it fades is an element that can still be clicked.
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
      className={cn(
        'gap-tight px-page pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center',
        // Clears the tab bar AND the basket bar above it, so a confirmation
        // never lands on the control the shopper is reaching for.
        'bottom-[calc(var(--nav-height)+var(--cart-bar-height)+0.5rem+var(--safe-bottom))]',
        'sm:bottom-6 sm:items-end',
      )}
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant];

        return (
          <div
            key={toast.id}
            className={cn(
              'animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3',
              'border-outline-variant bg-surface p-snug shadow-raised rounded-xl border',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                ACCENTS[toast.variant],
              )}
            >
              <Icon className="size-5" />
            </span>

            <div className="flex-1 pt-1">
              <p className="text-text text-sm font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="text-text-muted mt-0.5 text-sm">{toast.description}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="text-outline hover:bg-surface-muted -m-1 shrink-0 rounded-full p-1.5 transition-colors"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
