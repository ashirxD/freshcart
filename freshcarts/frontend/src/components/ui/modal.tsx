'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Sticky action row pinned to the bottom of the panel. */
  footer?: ReactNode;
  /** Mobile presentation: a bottom sheet reads as more natural on a phone. */
  variant?: 'sheet' | 'centered';
}

/**
 * Accessible dialog with the behaviours that are easy to forget:
 * Escape to close, background scroll lock, focus moved into the panel on open
 * and returned to the trigger on close.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'sheet',
}: ModalProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  /**
   * `onClose` is almost always an inline arrow at the call site, so it is a new
   * function on every render of the parent. Holding it in a ref keeps the
   * effect below dependent on `open` alone.
   *
   * That matters more than it looks: with `onClose` in the dependency array the
   * effect re-ran on every render and called `panelRef.focus()` each time —
   * which pulled focus out of whatever field the shopper was typing in after
   * every single keystroke, making any form inside a dialog unusable.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus the panel once, on open — never again while it stays open.
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div
        className="animate-fade-in bg-text/45 absolute inset-0 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'bg-surface shadow-overlay animate-sheet-up relative z-10 m-auto flex w-full flex-col outline-none',
          // A sheet rises from the bottom edge on a phone and becomes a centred
          // panel from `sm` up, where there is no bottom edge to rise from.
          variant === 'sheet'
            ? 'mt-auto mb-0 max-h-[90dvh] rounded-t-3xl sm:m-auto sm:max-w-md sm:rounded-2xl'
            : 'max-h-[90dvh] max-w-md rounded-2xl',
        )}
      >
        {/* The grab handle a phone sheet is expected to have. Decorative: the
            sheet is dismissed by the close button, Escape or the backdrop. */}
        {variant === 'sheet' ? (
          <span
            aria-hidden="true"
            className="bg-outline-variant mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full sm:hidden"
          />
        ) : null}

        <header className="gap-gutter px-page pt-loose pb-gutter flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-text text-lg font-bold tracking-[-0.015em]">{title}</h2>
            {description ? <p className="text-text-muted text-sm">{description}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="size-touch text-outline hover:bg-surface-muted -me-2 -mt-1 flex shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {children ? <div className="px-page pb-loose overflow-y-auto">{children}</div> : null}

        {footer ? (
          <footer className="border-outline-variant px-page py-gutter bg-surface-muted/60 border-t">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
