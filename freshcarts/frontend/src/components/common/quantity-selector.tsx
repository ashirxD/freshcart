'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface QuantitySelectorProps {
  value: number;
  onChange: (quantity: number) => void;
  min?: number;
  /** Usually the available stock. The control never lets a shopper exceed it. */
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Show a bin icon instead of "minus" when decrementing would reach zero. */
  removable?: boolean;
  size?: 'sm' | 'md';
  /**
   * What is being counted, phrased to follow a verb:
   * "quantity of Olpers Full Cream Milk" reads as "Increase quantity of…".
   */
  label?: string;
  /** Named in the remove label, so "Remove" is never ambiguous on a busy screen. */
  itemName?: string;
  className?: string;
}

/**
 * Presentational only: it reports the requested quantity and lets the caller
 * decide what that means (cart mutation, optimistic update, refetch). Stock
 * limits shown here are a convenience — the server remains the authority.
 *
 * THE MORPH (§25)
 * On a product card this control replaces the "Add" button in place, and it
 * arrives with `animate-pop` so the swap reads as one object changing rather
 * than two components trading places. It is the single most repeated
 * interaction on a grocery run, so it is worth the 260ms.
 *
 * THE COUNT (§34)
 * The number itself is keyed on its value, so each change ticks in. The live
 * region around it deliberately does NOT remount — re-creating an `aria-live`
 * element is how announcements get lost.
 */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled = false,
  removable = false,
  size = 'md',
  label = 'quantity',
  itemName,
  className,
}: QuantitySelectorProps) {
  const lowerBound = removable ? 0 : min;
  const canDecrease = !disabled && value > lowerBound;
  const canIncrease = !disabled && (max === undefined || value + step <= max);
  const willRemove = removable && value - step < min;

  const buttonSize = size === 'sm' ? 'size-9' : 'size-11';

  return (
    <div
      className={cn(
        'animate-pop inline-flex items-center justify-between gap-1 rounded-full',
        'bg-primary/8 ring-primary/15 ring-1',
        size === 'sm' ? 'p-0.5' : 'p-1',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(lowerBound, value - step))}
        disabled={!canDecrease}
        aria-label={willRemove ? 'Remove ' + (itemName ?? 'item') : 'Decrease ' + label}
        className={cn(
          'text-primary flex items-center justify-center rounded-full',
          'ease-standard transition-[background-color,color,transform] duration-150 active:scale-90',
          'hover:bg-surface disabled:text-outline disabled:pointer-events-none',
          willRemove && 'hover:text-danger',
          buttonSize,
        )}
      >
        {willRemove ? (
          <Trash2 className="size-4" aria-hidden="true" />
        ) : (
          <Minus className="size-4" aria-hidden="true" />
        )}
      </button>

      {/* Announced as a live value so screen-reader users hear the new quantity. */}
      <span
        aria-live="polite"
        aria-label={value + ' — ' + label}
        className={cn(
          'text-text min-w-7 overflow-hidden text-center font-bold tabular-nums',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
      >
        <span key={value} className="animate-tick inline-block">
          {value}
        </span>
      </span>

      <button
        type="button"
        onClick={() => onChange(value + step)}
        disabled={!canIncrease}
        aria-label={'Increase ' + label}
        className={cn(
          'bg-primary text-on-primary flex items-center justify-center rounded-full',
          'ease-standard transition-[background-color,transform] duration-150 active:scale-90',
          'hover:bg-primary-container disabled:bg-surface-sunken disabled:text-outline',
          buttonSize,
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
