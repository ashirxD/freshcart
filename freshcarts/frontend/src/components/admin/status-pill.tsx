import { Badge } from '@/components/ui/badge';

/**
 * Whether a catalogue record is visible to shoppers.
 *
 * "Live" / "Hidden" rather than "Active" / "Inactive": the question an admin is
 * actually asking is whether customers can see it. Built on the shared Badge so
 * it cannot drift from the order-status pills sitting in the next column.
 */
export function StatusPill({ isActive, className }: { isActive: boolean; className?: string }) {
  return (
    <Badge tone={isActive ? 'fresh' : 'neutral'} className={className}>
      {isActive ? 'Live' : 'Hidden'}
    </Badge>
  );
}
