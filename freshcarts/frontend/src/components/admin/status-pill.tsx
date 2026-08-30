import { cn } from '@/lib/cn';

/**
 * Whether a catalogue record is visible to shoppers.
 *
 * "Live" / "Hidden" rather than "Active" / "Inactive": the question an admin is
 * actually asking is whether customers can see it.
 */
export function StatusPill({ isActive, className }: { isActive: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        isActive ? 'bg-surface-muted text-success' : 'bg-surface-sunken text-text-muted',
        className,
      )}
    >
      {isActive ? 'Live' : 'Hidden'}
    </span>
  );
}
