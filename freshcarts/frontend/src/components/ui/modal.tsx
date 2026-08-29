'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-[1px]"
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
          'relative z-10 m-auto flex w-full flex-col bg-surface shadow-overlay outline-none',
          variant === 'sheet'
            ? 'mt-auto mb-0 max-h-[90dvh] rounded-t-lg sm:m-auto sm:max-w-md sm:rounded-lg'
            : 'max-h-[90dvh] max-w-md rounded-lg',
        )}
      >
        <header className="flex items-start justify-between gap-gutter px-page pt-lg pb-gutter">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            {description ? <p className="text-sm text-text-muted">{description}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-2 flex size-touch shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {children ? <div className="overflow-y-auto px-page pb-lg">{children}</div> : null}

        {footer ? (
          <footer className="border-t border-outline-variant px-page py-gutter">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
